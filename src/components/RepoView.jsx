"use client"
import { useState, useEffect, useRef, createContext, useContext } from 'react'
import Link from 'next/link'
import StatusFilesSection from '@/components/StatusFilesSection'
import gql from '@/lib/gql'
import { Q_STATUS, M_STAGE, M_COMMIT } from '@/lib/queries'

export default function RepoView({ repo, selectedFromRoute, hideSidebar = false }) {
  const [selected, setSelected] = useState(selectedFromRoute || 'history')
  const [staged, setStaged] = useState([])
  const [unstaged, setUnstaged] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mutating, setMutating] = useState(false)

  async function fetchStatus(opts) {
    const soft = !!opts?.soft
    if (!soft) {
      setLoading(true)
    }
    setError(null)
    try {
      const resp = await gql(Q_STATUS, { name: repo.name }, 'Status')
      if (resp.errors?.length) throw new Error(resp.errors[0].message || 'Failed to load status')
      const data = resp.data?.status || { staged: [], unstaged: [] }
      setStaged(Array.isArray(data.staged) ? data.staged : [])
      setUnstaged(Array.isArray(data.unstaged) ? data.unstaged : [])
    } catch (e) {
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
      } catch { }
    }
    load()
    // Load saved section for this repo from localStorage if no route override
    if (!selectedFromRoute) {
      try {
        const key = `repo:${repo.name}:section`
        const saved = (typeof window !== 'undefined' && window.localStorage.getItem(key))
        const valid = ['file-status', 'history', 'branches', 'tags', 'stashes']
        if (saved && valid.includes(saved)) {
          setSelected(saved)
        }
      } catch { }
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
    } catch { }
  }, [repo.name, selected])

  // Keep selected in sync with route changes
  useEffect(() => {
    if (selectedFromRoute) setSelected(selectedFromRoute)
  }, [selectedFromRoute])

  const onToggleAction = async (which, path) => {
    setMutating(true)
    try {
      const resp = await gql(M_STAGE, { name: repo.name, action: which, paths: [path] }, 'Stage')
      if (resp.errors?.length || !resp.data?.stage?.ok) throw new Error(resp.errors?.[0]?.message || `Failed to ${which} ${path}`)
      await fetchStatus({ soft: true })
    } catch (e) {
      console.error(e)
    } finally {
      setMutating(false)
    }
  }

  const onToggleMany = async (which, paths) => {
    if (!paths || paths.length === 0) return
    setMutating(true)
    try {
      const resp = await gql(M_STAGE, { name: repo.name, action: which, paths }, 'Stage')
      if (resp.errors?.length || !resp.data?.stage?.ok) throw new Error(resp.errors?.[0]?.message || `Failed to ${which} ${paths.length} paths`)
      await fetchStatus({ soft: true })
    } catch (e) {
      console.error(e)
    } finally {
      setMutating(false)
    }
  }


  return (
    <RepoStatusContext.Provider value={{ staged, unstaged, loading, error }}>
      <div className={`repo-shell${hideSidebar ? ' repo-shell--full' : ''}`}>
        <section className="repo-shell__content">
          <SectionContent selected={selected} repoName={repo.name} onToggleAction={onToggleAction} onToggleMany={onToggleMany} onCommitDone={() => fetchStatus({ soft: true })} mutating={mutating} />
        </section>
      </div>
    </RepoStatusContext.Provider>
  )
}


function SectionContent({ selected, repoName, onToggleAction, onToggleMany, onCommitDone, mutating }) {
  const { staged, unstaged, loading, error } = useRepoStatusContext()
  const [stagedView, setStagedView] = useState('tree')
  const [unstagedView, setUnstagedView] = useState('tree')

  // Load saved view preferences per repo on mount
  useEffect(() => {
    try {
      const k1 = `repo:${repoName}:view:staged`
      const k2 = `repo:${repoName}:view:unstaged`
      const v1 = (typeof window !== 'undefined' && window.localStorage.getItem(k1))
      const v2 = (typeof window !== 'undefined' && window.localStorage.getItem(k2))
      if (v1 === 'list' || v1 === 'tree') setStagedView(v1)
      if (v2 === 'list' || v2 === 'tree') setUnstagedView(v2)
    } catch { }
  }, [repoName])

  // Persist when preferences change
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`repo:${repoName}:view:staged`, stagedView)
        window.localStorage.setItem(`repo:${repoName}:view:unstaged`, unstagedView)
      }
    } catch { }
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
            {/* Staged + Unstaged split: each takes half the available vertical space and scroll internally */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, minHeight: 0 }}>
              <div style={{ flex: '1 1 50%', minHeight: 0 }}>
                <StatusFilesSection
                  title="Staged"
                  files={staged}
                  usePreferences={true}
                  repoName={repoName}
                  statusMode={'staged'}
                  actionLabel="Unstage"
                  onToggle={(path) => onToggleAction('unstage', path)}
                  enableBulk={true}
                  onBulk={() => onToggleMany('unstage', staged)}
                />
              </div>
              <div style={{ flex: '1 1 50%', minHeight: 0 }}>
                <StatusFilesSection
                  title="Unstaged"
                  files={unstaged}
                  usePreferences={true}
                  repoName={repoName}
                  statusMode={'unstaged'}
                  actionLabel="Stage"
                  onToggle={(path) => onToggleAction('stage', path)}
                  enableBulk={true}
                  onBulk={() => onToggleMany('stage', unstaged)}
                />
              </div>
            </div>
            {/* Commit row */}
            <CommitRow repoName={repoName} hasStaged={staged.length > 0} onCommitted={async () => { await onCommitDone(); }} />
          </div>
        )}
      </div>
    )
  }
  if (selected === 'history') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <h2>History</h2>
        <div style={{ flex: 1, minHeight: 0 }}>
          <HistorySection repoName={repoName} />
        </div>
      </div>
    )
  }
}

import HistorySection from '@/components/HistorySection'
const RepoStatusContext = createContext(null)

function useRepoStatusContext() {
  const ctx = useContext(RepoStatusContext)
  if (!ctx) throw new Error('RepoStatusContext not found')
  return ctx
}

function CommitRow({ repoName, hasStaged, onCommitted }) {
  const [message, setMessage] = useState('')
  const [committing, setCommitting] = useState(false)
  const [errorInfo, setErrorInfo] = useState(null)
  const disabled = !hasStaged
  const canCommit = !disabled && message.trim().length > 0 && !committing
  const settingsHref = `/repositories/${encodeURIComponent(repoName)}/settings`

  return (
    <>
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
            setErrorInfo(null)
            try {
              const resp = await gql(M_COMMIT, { name: repoName, message }, 'CommitCreate')
              if (resp.errors?.length || !resp.data?.commitCreate?.ok) throw new Error(resp.errors?.[0]?.message || 'Commit failed')
              setMessage('')
              if (onCommitted) await onCommitted()
            } catch (e) {
              console.error(e)
              const text = e?.message || 'Commit failed'
              const identityIssue = /author identity unknown/i.test(text) || /unable to auto-detect email address/i.test(text)
              setErrorInfo({ message: text, identityIssue })
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
      {errorInfo ? (
        <div
          className="commit-rail__dialog-backdrop"
          role="presentation"
          onClick={() => !committing && setErrorInfo(null)}
        >
          <div
            className="commit-rail__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="commit-error-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="commit-error-title">Commit failed</h3>
            <div className="commit-error__body">
              <p style={{ marginTop: 0 }}>Git reported the following error:</p>
              <pre className="commit-error__message">{errorInfo.message}</pre>
              {errorInfo.identityIssue ? (
                <p>
                  Configure your commit author details in the{' '}
                  <Link href={settingsHref} className="commit-error__link">repository settings</Link>{' '}
                  and try again.
                </p>
              ) : (
                <p>
                  Resolve the issue and retry, or visit the{' '}
                  <Link href={settingsHref} className="commit-error__link">repository settings</Link> for more options.
                </p>
              )}
            </div>
            <div className="commit-rail__dialog-actions">
              <button
                type="button"
                className="commit-rail__dialog-btn is-secondary"
                onClick={() => setErrorInfo(null)}
              >
                Close
              </button>
              <Link href={settingsHref} className="commit-rail__dialog-btn">
                Open Settings
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

// gql helper centralized in src/lib/gql
