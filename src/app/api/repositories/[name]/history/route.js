import { NextResponse } from 'next/server'
import { getLocalRepository } from '@/lib/repos'
import { execFile as _execFile } from 'child_process'
import { promisify } from 'util'
import { stat } from 'fs/promises'

const execFile = promisify(_execFile)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _req,
  context
) {
  try {
    const { name } = await context.params
    const repoName = decodeURIComponent(name)
    const repo = await getLocalRepository(repoName)
    if (!repo) return NextResponse.json({ error: 'Repository not found' }, { status: 404 })

    const isGit = await isGitRepository(repo.path)
    if (!isGit) return NextResponse.json({ commits: [], maxLanes: 0, notGit: true })

    const gitBin = process.env.GIT_BIN || 'git'
    // Latest first (top). Limit to 200 to keep UI snappy; adjust as needed.
    const { stdout } = await execFile(gitBin, [
      '-C', repo.path,
      'log', '--topo-order', '--date=iso-strict', '--pretty=format:%H%x00%h%x00%P%x00%s%x00%an%x00%ae%x00%aI', '-z', '-n', '200'
    ])
    const commits = parseLog(stdout)
    const { rows, maxLanes } = assignLanes(commits)

    // Map remote and local branch tips to commit ids for labeling
    const labelsById = new Map()
    try {
      const { stdout: refsOut } = await execFile(gitBin, [
        '-C', repo.path,
        'for-each-ref', 'refs/remotes/', '--format=%(refname:short)%00%(objectname)', '-z'
      ])
      const parts = refsOut.toString('utf8').split('\u0000').filter(Boolean)
      for (let i = 0; i + 1 < parts.length; i += 2) {
        const ref = (parts[i] || '').trim() // e.g. origin/main or origin/HEAD
        const obj = (parts[i + 1] || '').trim() // full sha
        if (!ref || !obj) continue
        if (/\/HEAD$/.test(ref)) continue // skip origin/HEAD
        const label = ref
        const arr = labelsById.get(obj) || []
        arr.push(label)
        labelsById.set(obj, arr)
      }
    } catch (_) {
      // Ignore labeling errors
    }
    // Local branches: refs/heads/* → label as "local/<branch>"
    try {
      const { stdout: headsOut } = await execFile(gitBin, [
        '-C', repo.path,
        'for-each-ref', 'refs/heads/', '--format=%(refname:short)%00%(objectname)', '-z'
      ])
      const parts = headsOut.toString('utf8').split('\u0000').filter(Boolean)
      for (let i = 0; i + 1 < parts.length; i += 2) {
        const br = (parts[i] || '').trim() // e.g. main or feature/x
        const obj = (parts[i + 1] || '').trim()
        if (!br || !obj) continue
        const label = `local/${br}`
        const arr = labelsById.get(obj) || []
        arr.push(label)
        labelsById.set(obj, arr)
      }
    } catch (_) {
      // ignore
    }
    // Mark current HEAD commit with a HEAD label
    try {
      const { stdout: headCommitOut } = await execFile(gitBin, ['-C', repo.path, 'rev-parse', 'HEAD'])
      const headCommit = headCommitOut.toString().trim()
      if (headCommit) {
        const arr = labelsById.get(headCommit) || []
        arr.push('HEAD')
        labelsById.set(headCommit, arr)
      }
    } catch (_) {}

    // Only return the essentials needed by the UI (dedupe labels)
    return NextResponse.json({
      commits: rows.map(r => ({
        id: r.id,
        short: r.short,
        lane: r.lane,
        parents: r.parents || [],
        parentLanes: r.parentLanes || [],
        labels: Array.from(new Set(labelsById.get(r.id) || [])),
        message: r.message,
        authorName: r.authorName,
        authorEmail: r.authorEmail,
        authorDate: r.authorDate
      })),
      maxLanes
    })
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return NextResponse.json({ error: 'Git binary not found. Install git or set GIT_BIN.' }, { status: 500 })
    }
    const message = error?.stderr?.toString?.() || error?.message || 'Unknown error'
    if (typeof message === 'string' && message.toLowerCase().includes('not a git repository')) {
      return NextResponse.json({ commits: [], maxLanes: 0, notGit: true })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function isGitRepository(repoPath) {
  try {
    const head = await stat(`${repoPath}/HEAD`).catch(() => null)
    if (head && head.isFile()) return true
    const gitDir = await stat(`${repoPath}/.git`).catch(() => null)
    if (gitDir && gitDir.isDirectory()) return true
    return false
  } catch {
    return false
  }
}

function parseLog(buf) {
  const s = Buffer.isBuffer(buf) ? buf.toString('utf8') : buf
  const parts = s.split('\u0000').filter(Boolean)
  const commits = []
  // Format: id\0short\0parents\0message\0authorName\0authorEmail\0authorDate
  for (let i = 0; i + 6 < parts.length; i += 7) {
    const id = parts[i]
    const short = parts[i + 1] || id.slice(0, 7)
    const parentsStr = parts[i + 2] || ''
    const message = parts[i + 3] || ''
    const authorName = parts[i + 4] || ''
    const authorEmail = parts[i + 5] || ''
    const authorDate = parts[i + 6] || ''
    const parents = parentsStr.trim() ? parentsStr.trim().split(' ') : []
    commits.push({ id, short, parents, message, authorName, authorEmail, authorDate })
  }
  return commits
}

function assignLanes(commits) {
  const active = []
  const rows = []
  let maxLanes = 0
  for (const c of commits) {
    let idx = active.indexOf(c.id)
    if (idx === -1) {
      idx = active.length
      active.push(c.id)
    }
    // Update active lanes: remove this commit, and compute parent lane positions
    active.splice(idx, 1)
    let insertAt = idx
    const parentLanes = []
    for (const p of c.parents) {
      const existing = active.indexOf(p)
      if (existing !== -1) {
        parentLanes.push(existing)
      } else {
        parentLanes.push(insertAt)
        active.splice(insertAt, 0, p)
        insertAt += 1
      }
    }
    // Record row after computing parent lanes
    rows.push({ id: c.id, short: c.short, parents: c.parents, lane: idx, parentLanes, message: c.message, authorName: c.authorName, authorEmail: c.authorEmail, authorDate: c.authorDate })
    if (active.length > maxLanes) maxLanes = active.length
  }
  // Ensure at least 1 lane if there are commits
  if (commits.length > 0) maxLanes = Math.max(maxLanes, 1)
  return { rows, maxLanes }
}
