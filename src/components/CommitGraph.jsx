"use client"
import React, { useMemo } from 'react'

export default function CommitGraph({ rows, maxLanes, selectedId, onSelect }) {
  const lanes = Math.max(1, Number(maxLanes) || 1)
  const prepared = useMemo(() => prepareRows(rows, lanes), [rows, lanes])
  return (
    <div className="commit-graph" style={{ height: '100%', minHeight: 0, overflow: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, padding: '8px 4px' }}>
        {prepared.map((r) => (
          <React.Fragment key={r.id}>
            <div key={r.id + ':graph'} className={`commit-graph__row ${selectedId === r.id ? 'is-selected' : ''}`} onClick={() => onSelect && onSelect(r)} style={{ display: 'grid', gridTemplateColumns: `repeat(${lanes}, 12px)`, gap: 0 }}>
              {r.cells.map((cell, idx) => (
                <div key={r.id + ':' + idx} className={`commit-graph__cell${cell.node ? ' is-node' : ''}${cell.conn ? ' is-connector' : ''}${cell.h ? ' has-hline' : ''}`} />
              ))}
            </div>
            <div key={r.id + ':text'} className={`commit-graph__row ${selectedId === r.id ? 'is-selected' : ''}`} onClick={() => onSelect && onSelect(r)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code className="tree__label">{r.short}</code>
              <span className="commit-label">hello</span>
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
  // Expect "remote/branch"; render as "[remote]/[branch]"
  const idx = s.indexOf('/')
  if (idx === -1) return `[${s}]`
  const remote = s.slice(0, idx)
  const branch = s.slice(idx + 1)
  return `[${remote}]/[${branch}]`
}


function formatMeta(name, email, dateIso) {
  const parts = []
  const who = [name || '', email ? `<${email}>` : ''].filter(Boolean).join(' ')
  if (who) parts.push(who)
  if (dateIso) {
    try {
      const d = new Date(dateIso)
      parts.push(d.toLocaleString())
    } catch {
      parts.push(dateIso)
    }
  }
  return parts.join(' • ')
}
