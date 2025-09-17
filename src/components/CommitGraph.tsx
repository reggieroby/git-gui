"use client"

type Row = { id?: string; short: string; lane: number; message?: string; authorName?: string; authorEmail?: string; authorDate?: string }

export default function CommitGraph({ rows, maxLanes, selectedId, onSelect }: { rows: Row[]; maxLanes: number; selectedId?: string; onSelect?: (row: Row) => void }) {
  const lanes = Math.max(maxLanes || 0, 1)
  return (
    <div className="commit-graph" style={{ display: 'grid', gap: 6 }}>
      {rows.map((r, i) => (
        <div
          key={`${i}-${r.short}`}
          className={`commit-graph__row${selectedId && r.id === selectedId ? ' is-selected' : ''}`}
          style={{ display: 'grid', gridTemplateColumns: `repeat(${lanes}, 14px) auto`, alignItems: 'center', gap: 8, cursor: onSelect ? 'pointer' : 'default' }}
          onClick={() => onSelect && onSelect(r)}
        >
          {Array.from({ length: lanes }).map((_, col) => (
            <div key={col} className={`commit-graph__cell${col === r.lane ? ' is-node' : ''}`}></div>
          ))}
          <div style={{ display: 'grid', gap: 2 }}>
            <div>
              <code style={{ fontSize: '0.85rem' }}>{r.short}</code>
              {r.message ? <span style={{ marginLeft: 8 }}>{r.message}</span> : null}
            </div>
            {(r.authorName || r.authorEmail || r.authorDate) && (
              <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>
                {formatMeta(r.authorName, r.authorEmail, r.authorDate)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function formatMeta(name?: string, email?: string, dateIso?: string): string {
  const parts: string[] = []
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
