"use client"
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSelectedLayoutSegments } from 'next/navigation'
import gql from '@/lib/gql'
import { Q_STATUS } from '@/lib/queries'

export default function RepositoriesSidebar({ repos, selectedName, selectedRepo }) {
  const segments = useSelectedLayoutSegments()
  const derivedName = segments[0] ? decodeURIComponent(segments[0]) : null
  const derivedSection = segments[1] ? decodeURIComponent(segments[1]) : null
  const currentName = selectedName || derivedName || null
  const activeSection = derivedSection || (currentName ? 'history' : null)
  const [expanded, setExpanded] = useState(!currentName)
  const repoList = useMemo(() => Array.isArray(repos) ? repos : [], [repos])
  const currentRepo = currentName
    ? (selectedRepo && selectedRepo.name === currentName
      ? selectedRepo
      : repoList.find((r) => r.name === currentName) || null)
    : null
  const [dirtyMap, setDirtyMap] = useState({})
  const [dirtyLoading, setDirtyLoading] = useState(false)
  const currentRepoName = currentRepo?.name || null

  useEffect(() => {
    setExpanded(!currentName)
  }, [currentName])

  useEffect(() => {
    let cancelled = false
    async function loadDirty() {
      const list = Array.isArray(repos) ? repos : []
      if (!expanded || list.length === 0) return
      setDirtyLoading(true)
      const map = {}
      for (const r of list) {
        try {
          const resp = await gql(Q_STATUS, { name: r.name }, 'Status')
          if (resp.errors?.length) continue
          const st = resp.data?.status || { staged: [], unstaged: [] }
          const hasChanges = (Array.isArray(st.staged) && st.staged.length > 0) || (Array.isArray(st.unstaged) && st.unstaged.length > 0)
          if (!cancelled) map[r.name] = hasChanges
        } catch (e) {
          // ignore per-repo failures
        }
      }
      if (!cancelled) setDirtyMap(map)
      if (!cancelled) setDirtyLoading(false)
    }
    loadDirty()
    return () => { cancelled = true }
  }, [expanded, repos])

  useEffect(() => {
    if (expanded) return
    if (!currentRepoName) return
    if (typeof dirtyMap[currentRepoName] !== 'undefined') return
    let cancelled = false

    async function loadCurrent() {
      try {
        const resp = await gql(Q_STATUS, { name: currentRepoName }, 'Status')
        if (cancelled || resp.errors?.length) return
        const st = resp.data?.status || { staged: [], unstaged: [] }
        const hasChanges = (Array.isArray(st.staged) && st.staged.length > 0) || (Array.isArray(st.unstaged) && st.unstaged.length > 0)
        setDirtyMap((prev) => {
          if (prev[currentRepoName] === hasChanges) return prev
          return { ...prev, [currentRepoName]: hasChanges }
        })
      } catch (e) {
        // ignore fetch errors while collapsed
      }
    }

    loadCurrent()
    return () => { cancelled = true }
  }, [expanded, currentRepoName, dirtyMap])


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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span>{currentRepo.name}</span>
                {dirtyMap[currentRepo.name] ? (
                  <span
                    title="Repository has unstaged/staged changes"
                    style={{
                      whiteSpace: 'nowrap',
                      fontSize: '0.7rem',
                      border: '1px solid #fde3c7',
                      background: '#fff7ed',
                      color: '#92400e',
                      padding: '0.06rem 0.4rem',
                      borderRadius: 999
                    }}
                  >
                    changes
                  </span>
                ) : null}
                {currentRepo.hasUnpushedCommits ? (
                  <span
                    title="At least one local branch has commits not present on any remote"
                    style={{
                      whiteSpace: 'nowrap',
                      fontSize: '0.7rem',
                      border: '1px solid #bfdbfe',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      padding: '0.06rem 0.4rem',
                      borderRadius: 999
                    }}
                  >
                    unpushed
                  </span>
                ) : null}
              </span>
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
                const hasUnpushed = !!repo.hasUnpushedCommits
                const isDirty = dirtyMap[repo.name]
                return (
                  <li key={repo.path} className={active ? 'is-active' : undefined}>
                    <Link href={`/repositories/${encodeURIComponent(repo.name)}/history`}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span>{repo.name}</span>
                        {/* show 'changes' tag when repo is not clean */}
                        {isDirty ? (
                          <span
                            title="Repository has unstaged/staged changes"
                            style={{
                              whiteSpace: 'nowrap',
                              fontSize: '0.7rem',
                              border: '1px solid #fde3c7',
                              background: '#fff7ed',
                              color: '#92400e',
                              padding: '0.06rem 0.4rem',
                              borderRadius: 999
                            }}
                          >
                            changes
                          </span>
                        ) : null}
                        {hasUnpushed ? (
                          <span
                            title="At least one local branch has commits not present on any remote"
                            style={{
                              whiteSpace: 'nowrap',
                              fontSize: '0.7rem',
                              border: '1px solid #bfdbfe',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              padding: '0.06rem 0.4rem',
                              borderRadius: 999
                            }}
                          >
                            unpushed
                          </span>
                        ) : null}
                      </span>
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
