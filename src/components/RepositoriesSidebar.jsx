"use client"
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSelectedLayoutSegments } from 'next/navigation'

export default function RepositoriesSidebar({ repos, selectedName, selectedRepo }) {
  const segments = useSelectedLayoutSegments()
  const derivedName = segments[0] ? decodeURIComponent(segments[0]) : null
  const derivedSection = segments[1] ? decodeURIComponent(segments[1]) : null
  const currentName = selectedName || derivedName || null
  const activeSection = derivedSection || (currentName ? 'history' : null)
  const [expanded, setExpanded] = useState(!currentName)

  useEffect(() => {
    setExpanded(!currentName)
  }, [currentName])

  const repoList = useMemo(() => Array.isArray(repos) ? repos : [], [repos])
  const currentRepo = currentName
    ? (selectedRepo && selectedRepo.name === currentName
        ? selectedRepo
        : repoList.find((r) => r.name === currentName) || null)
    : null

  return (
    <div className="repositories-collection__sidebar">
      <div className="repositories-collection__list">
        <button
          type="button"
          className="repositories-collection__toggle"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
        >
          <span style={{ fontWeight: 600 }}>Repositories</span>
          <span aria-hidden style={{ marginLeft: 'auto' }}>{expanded ? '▴' : '▾'}</span>
        </button>
        {!expanded && currentRepo && (
          <div className="repositories-collection__current">
            <Link href={`/repositories/${encodeURIComponent(currentRepo.name)}/history`}>
              <span>{currentRepo.name}</span>
              <span className="branch" title={currentRepo.branch ?? 'unknown'}>{currentRepo.branch ?? 'unknown'}</span>
            </Link>
          </div>
        )}
        {expanded && (
          <ul className="repositories-collection__repos">
            {repoList.length === 0 ? (
              <li style={{ opacity: 0.7, padding: '0.5rem 0.25rem' }}>No repositories found.</li>
            ) : (
              repoList.map((repo) => {
                const active = currentName === repo.name
                return (
                  <li key={repo.path} className={active ? 'is-active' : undefined}>
                    <Link href={`/repositories/${encodeURIComponent(repo.name)}/history`}>
                      <span>{repo.name}</span>
                      <span className="branch" title={repo.branch ?? 'unknown'}>{repo.branch ?? 'unknown'}</span>
                    </Link>
                  </li>
                )
              })
            )}
          </ul>
        )}
      </div>
      {currentName && currentRepo ? (
        <div className="repositories-collection__repo-nav">
          <div className="repositories-collection__details">
            <div className="repositories-collection__details-title">Details</div>
            <ul className="repositories-collection__details-list">
              {[
                { id: 'file-status', label: 'File Status' },
                { id: 'history', label: 'History' },
                { id: 'settings', label: 'Settings' }
              ].map(({ id, label }) => {
                const active = (activeSection || 'history') === id
                return (
                  <li key={id} className={active ? 'is-active' : undefined}>
                    <Link href={`/repositories/${encodeURIComponent(currentRepo.name)}/${id}`}>
                      {label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      ) : (
        <div style={{ padding: '1rem 0.5rem', opacity: 0.75 }}>Select a repository to view details.</div>
      )}
    </div>
  )
}
