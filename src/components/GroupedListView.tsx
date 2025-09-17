"use client"

export default function GroupedListView({
  paths,
  onToggle,
  actionLabel
}: {
  paths: string[]
  onToggle: (path: string, isFile: boolean) => void
  actionLabel: string
}) {
  const files = [...paths].sort((a, b) => a.localeCompare(b))
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {files.map((p) => (
        <li key={p} className="tree__label" style={{ padding: '2px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" aria-label={actionLabel} onChange={() => onToggle(p, true)} />
          📄 {p}
        </li>
      ))}
    </ul>
  )
}
