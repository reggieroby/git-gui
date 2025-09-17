"use client"
import Link from 'next/link'

export default function RepoSidebar({ selected, onSelect, basePath, repo }) {
  const items = [
    { id: 'file-status', label: 'File Status' },
    { id: 'history', label: 'History' },
    { id: 'branches', label: 'Branches' },
    { id: 'tags', label: 'Tags' },
    { id: 'stashes', label: 'Stashes' }
  ]

  return (
    <nav aria-label="Repository sections" className="repo-sidebar">
      <div className="repo-sidebar__header">
        {repo ? (
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600 }}>{repo.name}</span>
                <span
                  title={repo.branch ?? 'unknown'}
                  style={{
                    whiteSpace: 'nowrap',
                    fontSize: '0.75rem',
                    border: '1px solid #e0e7ff',
                    background: '#eef2ff',
                    color: '#3730a3',
                    padding: '0.1rem 0.5rem',
                    borderRadius: 999
                  }}
                >
                  {repo.branch ?? 'unknown'}
                </span>
              </div>
              <Link
                href={repo ? `/repositories/${encodeURIComponent(repo.name)}/settings` : '#'}
                title="Repository settings"
                className={`repo-sidebar__settings${selected === 'settings' ? ' is-active' : ''}`}
                aria-label="Repository settings"
              >
                ⚙️
              </Link>
            </div>
            <div style={{ opacity: 0.7, fontSize: '0.8rem' }}>{repo.path}</div>
          </div>
        ) : (
          'Repository'
        )}
      </div>
      <ul className="repo-sidebar__list">
        {items.map((it) => {
          const active = selected === it.id
          return (
            <li
              key={it.id}
              className={`repo-sidebar__item${active ? ' repo-sidebar__item--active' : ''}`}
            >
              <Link
                href={`${basePath}/${it.id}`}
                className="repo-sidebar__button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onSelect && onSelect(it.id)}
              >
                {it.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
