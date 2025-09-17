"use client"
import RepoSidebar, { SectionId } from '@/components/RepoSidebar'
import TreeView from '@/components/TreeView'
import GroupedListView from '@/components/GroupedListView'
import StatusFilesSection from '@/components/StatusFilesSection'

type Repo = {
  name: string
  path: string
  branch: string | null
}

export default function RepoView({ repo, selectedFromRoute }: { repo: Repo; selectedFromRoute?: import('./RepoSidebar').SectionId }) {
  const [selected, setSelected] = useState<SectionId>(selectedFromRoute || 'history')
  const [staged, setStaged] = useState<string[]>([])
  const [unstaged, setUnstaged] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mutating, setMutating] = useState(false)

  async function fetchStatus(opts?: { soft?: boolean }) {
    const soft = !!opts?.soft
    if (!soft) {
      setLoading(true)
    }
    setError(null)
    try {
      const res = await fetch(`/api/repositories/${encodeURIComponent(repo.name)}/status`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok && data?.error) throw new Error(data.error)
      if (!res.ok) throw new Error(`Failed to load status (${res.status})`)
      setStaged(Array.isArray(data.staged) ? data.staged : [])
      setUnstaged(Array.isArray(data.unstaged) ? data.unstaged : [])
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load status')
    } finally {
      if (!soft) setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await fetchStatus()
      } catch {}
    }
    load()
    // Load saved section for this repo from localStorage if no route override
    if (!selectedFromRoute) {
      try {
        const key = `repo:${repo.name}:section`
        const saved = (typeof window !== 'undefined' && window.localStorage.getItem(key)) as SectionId | null
        const valid: SectionId[] = ['file-status', 'history', 'branches', 'tags', 'stashes']
        if (saved && (valid as string[]).includes(saved)) {
          setSelected(saved)
        }
      } catch {}
    } else {
      setSelected(selectedFromRoute)
    }
    return () => {
      cancelled = true
    }
  }, [repo.name])

  // Persist selected section per repo
  useEffect(() => {
    try {
      const key = `repo:${repo.name}:section`
      if (typeof window !== 'undefined') window.localStorage.setItem(key, selected)
    } catch {}
  }, [repo.name, selected])

  // Keep selected in sync with route changes
  useEffect(() => {
    if (selectedFromRoute) setSelected(selectedFromRoute)
  }, [selectedFromRoute])

  const onToggleAction = async (which: 'stage' | 'unstage', path: string) => {
    setMutating(true)
    try {
      const res = await fetch(`/api/repositories/${encodeURIComponent(repo.name)}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: which, paths: [path] })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok && (data as any)?.error) throw new Error((data as any).error)
      if (!res.ok) throw new Error(`Failed to ${which} ${path}`)
      await fetchStatus({ soft: true })
    } catch (e) {
      console.error(e)
    } finally {
      setMutating(false)
    }
  }

  const onToggleMany = async (which: 'stage' | 'unstage', paths: string[]) => {
    if (!paths || paths.length === 0) return
    setMutating(true)
    try {
      const res = await fetch(`/api/repositories/${encodeURIComponent(repo.name)}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: which, paths })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok && (data as any)?.error) throw new Error((data as any).error)
      if (!res.ok) throw new Error(`Failed to ${which} ${paths.length} paths`)
      await fetchStatus({ soft: true })
    } catch (e) {
      console.error(e)
    } finally {
      setMutating(false)
    }
  }

  return (
    <RepoStatusContext.Provider value={{ staged, unstaged, loading, error }}>
      <div className="repo-shell">
        <aside className="repo-shell__sidebar">
          <RepoSidebar selected={selected} basePath={`/repositories/${encodeURIComponent(repo.name)}`} onSelect={setSelected} repo={{ name: repo.name, branch: repo.branch, path: repo.path }} />
        </aside>
        <section className="repo-shell__content">
          <SectionContent selected={selected} repoName={repo.name} onToggleAction={onToggleAction} onToggleMany={onToggleMany} onCommitDone={() => fetchStatus({ soft: true })} mutating={mutating} />
        </section>
      </div>
    </RepoStatusContext.Provider>
  )
}

import { useState, useEffect } from 'react'

function Header({ name, branch, path }: { name: string; branch: string | null; path: string }) {
  return (
    <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <h1 style={{ margin: 0 }}>{name}</h1>
        <span
          title={branch ?? 'unknown'}
          style={{
            whiteSpace: 'nowrap',
            fontSize: '0.85rem',
            border: '1px solid #e0e7ff',
            background: '#eef2ff',
            color: '#3730a3',
            padding: '0.2rem 0.6rem',
            borderRadius: 999
          }}
        >
          {branch ?? 'unknown'}
        </span>
      </div>
      <div style={{ opacity: 0.8 }}>
        <div style={{ fontSize: '0.9rem' }}>
          Path: <code>{path}</code>
        </div>
      </div>
    </div>
  )
}

function SectionContent({ selected, repoName, onToggleAction, onToggleMany, onCommitDone, mutating }: { selected: SectionId; repoName: string; onToggleAction: (which: 'stage' | 'unstage', path: string) => void; onToggleMany: (which: 'stage' | 'unstage', paths: string[]) => void; onCommitDone: () => Promise<void>; mutating: boolean }) {
  const { staged, unstaged, loading, error } = useRepoStatusContext()
  const [stagedView, setStagedView] = useState<'list' | 'tree'>('tree')
  const [unstagedView, setUnstagedView] = useState<'list' | 'tree'>('tree')
  const [stagedExpandSig, setStagedExpandSig] = useState(0)
  const [stagedCollapseSig, setStagedCollapseSig] = useState(0)
  const [unstagedExpandSig, setUnstagedExpandSig] = useState(0)
  const [unstagedCollapseSig, setUnstagedCollapseSig] = useState(0)
  const [stagedExpandedPaths, setStagedExpandedPaths] = useState<Set<string>>(() => new Set())
  const [unstagedExpandedPaths, setUnstagedExpandedPaths] = useState<Set<string>>(() => new Set())

  // Load saved view preferences per repo on mount
  useEffect(() => {
    try {
      const k1 = `repo:${repoName}:view:staged`
      const k2 = `repo:${repoName}:view:unstaged`
      const v1 = (typeof window !== 'undefined' && window.localStorage.getItem(k1)) as 'list' | 'tree' | null
      const v2 = (typeof window !== 'undefined' && window.localStorage.getItem(k2)) as 'list' | 'tree' | null
      if (v1 === 'list' || v1 === 'tree') setStagedView(v1)
      if (v2 === 'list' || v2 === 'tree') setUnstagedView(v2)
    } catch {}
  }, [repoName])

  // Persist when preferences change
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`repo:${repoName}:view:staged`, stagedView)
        window.localStorage.setItem(`repo:${repoName}:view:unstaged`, unstagedView)
      }
    } catch {}
  }, [repoName, stagedView, unstagedView])
  if (selected === 'file-status') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <h2 style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>File Status</span>
          {(mutating || loading) && <span className="loading-dot" aria-hidden title="Updating status" />}
        </h2>
        {loading ? (
          <div style={{ opacity: 0.7 }}>Loading status…</div>
        ) : error ? (
          <div style={{ color: '#b91c1c' }}>
            Error: {error}
            {error.toLowerCase().includes('git') && (
              <div style={{ marginTop: 6, opacity: 0.85 }}>
                Ensure Git is installed and available on the server PATH, or set the <code>GIT_BIN</code> env var to the git executable path.
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, minHeight: 0 }}>
            {/* Staged section */}
            <StatusFilesSection
              title="Staged"
              files={staged}
              viewKey={`repo:${repoName}:view:staged`}
              defaultViewKey={'prefs:fileStatusDefaultView'}
              repoName={repoName}
              statusMode={'staged'}
              actionLabel="Unstage"
              onToggle={(path) => onToggleAction('unstage', path)}
              enableBulk={true}
              onBulk={() => onToggleMany('unstage', staged)}
            />
            {/* Unstaged section */}
            <StatusFilesSection
              title="Unstaged"
              files={unstaged}
              viewKey={`repo:${repoName}:view:unstaged`}
              defaultViewKey={'prefs:fileStatusDefaultView'}
              repoName={repoName}
              statusMode={'unstaged'}
              actionLabel="Stage"
              onToggle={(path) => onToggleAction('stage', path)}
              enableBulk={true}
              onBulk={() => onToggleMany('stage', unstaged)}
            />
            {/* Commit row */}
            <CommitRow repoName={repoName} hasStaged={staged.length > 0} onCommitted={async () => { await onCommitDone(); }} />
          </div>
        )}
      </div>
    )
  }
  if (selected === 'history') {
    return (
      <div>
        <h2>History</h2>
        <HistorySection repoName={repoName} />
      </div>
    )
  }
  if (selected === 'branches') {
    return (
      <div>
        <h2>Branches</h2>
        <div style={{ opacity: 0.7 }}>Branches list will appear here.</div>
      </div>
    )
  }
  if (selected === 'tags') {
    return (
      <div>
        <h2>Tags</h2>
        <div style={{ opacity: 0.7 }}>Tags will appear here.</div>
      </div>
    )
  }
  return (
    <div>
      <h2>Stashes</h2>
      <div style={{ opacity: 0.7 }}>Stashes will appear here.</div>
    </div>
  )
}

import { createContext, useContext } from 'react'
import HistorySection from '@/components/HistorySection'

type RepoStatusContextValue = {
  staged: string[]
  unstaged: string[]
  loading: boolean
  error: string | null
}

const RepoStatusContext = createContext<RepoStatusContextValue | null>(null)

function useRepoStatusContext(): RepoStatusContextValue {
  const ctx = useContext(RepoStatusContext)
  if (!ctx) throw new Error('RepoStatusContext not found')
  return ctx
}

function CommitRow({ repoName, hasStaged, onCommitted }: { repoName: string; hasStaged: boolean; onCommitted?: () => void }) {
  const [message, setMessage] = useState('')
  const [committing, setCommitting] = useState(false)
  const disabled = !hasStaged
  const canCommit = !disabled && message.trim().length > 0 && !committing

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
      <textarea
        placeholder={disabled ? 'No staged changes' : 'Commit message'}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={disabled || committing}
        rows={2}
        style={{ flex: 1, resize: 'vertical', minHeight: 38 }}
      />
      <button
        type="button"
        onClick={async () => {
          if (!canCommit) return
          setCommitting(true)
          try {
            const res = await fetch(`/api/repositories/${encodeURIComponent(repoName)}/commit`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message })
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error((data as any)?.error || `Commit failed (${res.status})`)
            setMessage('')
            // notify and refresh status
            if (onCommitted) await onCommitted()
            // Force status refresh by dispatching a storage event or rely on page state; here we do nothing and expect user to see staged empty after fetchStatus external triggers.
          } catch (e) {
            console.error(e)
          } finally {
            setCommitting(false)
          }
        }}
        disabled={!canCommit}
        style={{ padding: '0.5rem 0.75rem' }}
      >
        {committing ? 'Committing…' : 'Commit'}
      </button>
    </div>
  )
}

 
