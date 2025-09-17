"use client"

export default function GroupedListView({
  paths,
  onToggle,
  onFileClick,
  actionLabel
}: {
  paths: string[]
  onToggle?: (path: string, isFile: boolean) => void
  onFileClick?: (path: string) => void
  actionLabel?: string
}) {
  const files = [...paths].sort((a, b) => a.localeCompare(b))
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {files.map((p) => (
        <li key={p} className="tree__label" style={{ padding: '2px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          {onToggle ? (
            <input type="checkbox" aria-label={actionLabel || 'toggle'} onChange={() => onToggle(p, true)} />
          ) : null}
          <button type="button" onClick={() => onFileClick && onFileClick(p)} style={{ background: 'transparent', border: 'none', padding: 0, margin: 0, cursor: onFileClick ? 'pointer' : 'default', color: 'inherit' }}>
            📄 {p}
          </button>
        </li>
      ))}
    </ul>
  )
}
