"use client"
import React, { useEffect, useMemo, useRef } from 'react'

export default function CommitGraph({ rows, maxLanes, selectedId, onSelect }) {
  const lanes = Math.max(1, Number(maxLanes) || 1)
  const prepared = useMemo(() => prepareRows(rows, lanes), [rows, lanes])
  const rowRefs = useRef(new Map())

  useEffect(() => () => { rowRefs.current.clear() }, [])

  useEffect(() => {
    if (!selectedId) return
    const el = rowRefs.current.get(selectedId)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [selectedId])
  return (
    <div className="commit-graph" style={{ height: '100%', minHeight: 0, overflow: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, padding: '8px 4px' }}>
        {prepared.map((r) => (
          <React.Fragment key={r.id}>
            <div
              key={r.id + ':graph'}
              className={`commit-graph__row ${selectedId === r.id ? 'is-selected' : ''}`}
              onClick={() => onSelect && onSelect(r)}
              style={{ display: 'grid', gridTemplateColumns: `repeat(${lanes}, 12px)`, gap: 0 }}
              ref={(el) => {
                if (!el) { rowRefs.current.delete(r.id); return }
                rowRefs.current.set(r.id, el)
              }}
            >
              {r.cells.map((cell, idx) => (
                <div key={r.id + ':' + idx} className={`commit-graph__cell${cell.node ? ' is-node' : ''}${cell.conn ? ' is-connector' : ''}${cell.h ? ' has-hline' : ''}`} />
              ))}
            </div>
            <div
              key={r.id + ':text'}
              className={`commit-graph__row ${selectedId === r.id ? 'is-selected' : ''}`}
              onClick={() => onSelect && onSelect(r)}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              ref={(el) => {
                if (!el) { rowRefs.current.delete(r.id); return }
                rowRefs.current.set(r.id, el)
              }}
            >
              <code className="tree__label">{r.short}</code>
              {r.labels.map((l) => (
                <span key={r.id + ':' + l} className="commit-label">{formatRemoteLabel(l)}</span>
              ))}
              <span>{r.message}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

function prepareRows(rows, lanes) {
  const out = []
  for (const r of rows || []) {
    const cells = Array.from({ length: lanes }, () => ({ node: false, conn: false, h: false }))
    const lane = Math.max(0, Math.min(lanes - 1, Number(r.lane) || 0))
    const parentLanes = Array.isArray(r.parentLanes) ? r.parentLanes.map(n => Math.max(0, Math.min(lanes - 1, Number(n) || 0))) : []
    cells[lane].node = true
    cells[lane].conn = true
    for (const pl of parentLanes) {
      cells[pl].conn = true
      // optional simple horizontal indicator: mark cell between lanes
      const lo = Math.min(lane, pl)
      const hi = Math.max(lane, pl)
      for (let i = lo; i <= hi; i++) cells[i].h = true
    }
    out.push({ id: r.id, short: r.short || (r.id || '').slice(0, 7), labels: Array.isArray(r.labels) ? r.labels : [], message: r.message || '', cells })
  }
  return out
}

function formatRemoteLabel(l) {
  const s = String(l || '')
  if (s === 'HEAD') return 'HEAD'
  if (s.startsWith('refs/heads/')) return `[local]/[${s.slice('refs/heads/'.length)}]`
  if (s.startsWith('refs/remotes/')) {
    const rest = s.slice('refs/remotes/'.length)
    const idx = rest.indexOf('/')
    if (idx === -1) return `[remote]/[${rest}]`
    const remote = rest.slice(0, idx)
    const branch = rest.slice(idx + 1)
    return `[${remote}]/[${branch}]`
  }
  const idx = s.indexOf('/')
  if (idx === -1) return `[${s}]`
  const remote = s.slice(0, idx)
  const branch = s.slice(idx + 1)
  return `[${remote}]/[${branch}]`
}
