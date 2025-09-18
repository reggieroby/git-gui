// Commit Graph Layout Engine (no GUI) — v0
// Provides: normalize, topoRowOrder, assignLanes, routeEdges

/**
 * @typedef {Object} Commit
 * @property {string} id
 * @property {string[]} parents
 * @property {number} authorTime // unix ms
 * @property {string} subject
 * @property {string} author
 * @property {string[]} [refs]
 * @property {Object} [meta]
 */

/**
 * Normalize commits and build indices.
 * @param {Commit[]} commits
 */
export function normalize(commits) {
  /** @type {Map<string, Commit>} */
  const byId = new Map()
  /** @type {Map<string, string[]>} */
  const childrenById = new Map()
  const merges = new Set()
  const roots = new Set()

  for (const c of commits) {
    byId.set(c.id, c)
  }
  for (const c of commits) {
    const ps = Array.isArray(c.parents) ? c.parents : []
    if (ps.length === 0) roots.add(c.id)
    if (ps.length > 1) merges.add(c.id)
    for (const p of ps) {
      const arr = childrenById.get(p) || []
      arr.push(c.id)
      childrenById.set(p, arr)
    }
  }
  return { commitById: byId, childrenById, merges, roots }
}

/**
 * Compute row order: primarily by authorTime desc with stable tie on input order.
 * We assume input is already a reasonable topological order (git --topo-order).
 * @param {Commit[]} commits
 * @returns {string[]} commit ids in row order (top to bottom)
 */
export function topoRowOrder(commits) {
  return commits
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      const dt = (b.c.authorTime || 0) - (a.c.authorTime || 0)
      if (dt !== 0) return dt
      return a.i - b.i
    })
    .map((e) => e.c.id)
}

/**
 * Assign lanes using a git-like algorithm.
 * @param {string[]} rows row order (commit ids, newest first)
 * @param {Map<string, Commit>} commitById
 */
export function assignLanes(rows, commitById) {
  /** @type {(string|null)[]} */
  const active = []
  /** @type {Map<string, number>} */
  const laneByCommit = new Map()
  /** @type {Map<string, number[]>} */
  const parentLanesByCommit = new Map()
  let maxLanes = 0

  for (const id of rows) {
    const commit = commitById.get(id)
    if (!commit) continue
    // Reuse lane if this commit is already in active lanes
    let lane = active.indexOf(id)
    if (lane === -1) {
      // take first free slot or push
      lane = firstFree(active)
      if (lane === -1) { lane = active.length; active.push(id) }
      else active[lane] = id
    }

    // Remove this commit, then place parents
    active[lane] = null
    let insertAt = lane
    const parentLanes = []
    const parents = Array.isArray(commit.parents) ? commit.parents : []
    for (const p of parents) {
      const existing = active.indexOf(p)
      if (existing !== -1) {
        parentLanes.push(existing)
      } else {
        // reserve at insertAt or first free after
        let spot = insertAt < active.length ? insertAt : active.length
        // ensure spot is free
        while (spot < active.length && active[spot] !== null) spot++
        if (spot === active.length) active.push(p)
        else active[spot] = p
        parentLanes.push(spot)
        insertAt = spot + 1
      }
    }
    laneByCommit.set(id, lane)
    parentLanesByCommit.set(id, parentLanes)
    // collapse trailing nulls
    while (active.length && active[active.length - 1] === null) active.pop()
    if (active.length > maxLanes) maxLanes = active.length
  }

  return { laneByCommit, parentLanesByCommit, maxLanes }
}

function firstFree(arr) {
  for (let i = 0; i < arr.length; i++) if (arr[i] === null) return i
  return -1
}

/**
 * Compute geometry for nodes and edges.
 * @param {string[]} rows
 * @param {Map<string, Commit>} commitById
 * @param {Map<string, number>} laneByCommit
 * @param {Object} cfg layout sizes
 */
export function computeGeometry(rows, commitById, laneByCommit, cfg) {
  const { colWidth = 22, rowHeight = 28, nodeRadius = 6, colPad = 20, rowPad = 14 } = cfg || {}
  const nodes = []
  const nodeIndex = new Map()
  for (let i = 0; i < rows.length; i++) {
    const id = rows[i]
    const c = commitById.get(id)
    if (!c) continue
    const lane = laneByCommit.get(id) || 0
    const x = colPad + lane * colWidth
    const y = rowPad + i * rowHeight
    nodes.push({ id, x, y, lane, r: nodeRadius, commit: c })
    nodeIndex.set(id, nodes.length - 1)
  }
  return { nodes, nodeIndex, sizes: { colWidth, rowHeight, nodeRadius, colPad, rowPad } }
}

/**
 * Compute edges as bezier polylines between child and parents.
 * @param {{nodes: any[], nodeIndex: Map<string,number>, sizes: any}} geom
 * @param {Map<string, Commit>} commitById
 * @param {Map<string, number[]>} parentLanesByCommit
 * @param {Object} cfg
 */
export function routeEdges(geom, commitById, parentLanesByCommit, cfg) {
  const { nodes, nodeIndex, sizes } = geom
  const { colWidth, rowHeight } = sizes
  const tension = Math.min(1, Math.max(0, cfg?.bezierTension ?? 0.35))
  const edges = []
  for (const n of nodes) {
    const commit = commitById.get(n.id)
    if (!commit) continue
    const parents = Array.isArray(commit.parents) ? commit.parents : []
    const parentLanes = parentLanesByCommit.get(n.id) || []
    for (let i = 0; i < parents.length; i++) {
      const pid = parents[i]
      const pIndex = nodeIndex.get(pid)
      if (pIndex == null) continue // parent may be outside window
      const pn = nodes[pIndex]
      const sameLane = (pn.lane === n.lane)
      if (sameLane) {
        edges.push({ key: `${n.id}->${pid}`, from: { x: n.x, y: n.y }, to: { x: pn.x, y: pn.y }, kind: 'line' })
      } else {
        const sign = Math.sign(pn.lane - n.lane) || 1
        const P0 = { x: n.x, y: n.y }
        const P3 = { x: pn.x, y: pn.y }
        const P1 = { x: P0.x, y: P0.y + rowHeight * 0.5 * tension }
        const P2 = { x: P3.x - sign * colWidth * 0.6, y: P3.y - rowHeight * 0.5 * tension }
        edges.push({ key: `${n.id}->${pid}`, from: P0, to: P3, c1: P1, c2: P2, kind: 'bezier' })
      }
    }
  }
  return edges
}

