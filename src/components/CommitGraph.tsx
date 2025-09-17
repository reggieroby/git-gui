"use client"

type Row = { short: string; lane: number }

export default function CommitGraph({ rows, maxLanes }: { rows: Row[]; maxLanes: number }) {
  const lanes = Math.max(maxLanes || 0, 1)
  return (
    <div className="commit-graph" style={{ display: 'grid', gap: 6 }}>
      {rows.map((r, i) => (
        <div
          key={`${i}-${r.short}`}
          className="commit-graph__row"
          style={{ display: 'grid', gridTemplateColumns: `repeat(${lanes}, 14px) auto`, alignItems: 'center', gap: 8 }}
        >
          {Array.from({ length: lanes }).map((_, col) => (
            <div key={col} className={`commit-graph__cell${col === r.lane ? ' is-node' : ''}`}></div>
          ))}
          <code style={{ fontSize: '0.85rem' }}>{r.short}</code>
        </div>
      ))}
    </div>
  )
}

