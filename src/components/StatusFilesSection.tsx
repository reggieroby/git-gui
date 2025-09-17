"use client"
import { useEffect, useState } from 'react'
import GroupedListView from '@/components/GroupedListView'
import TreeView from '@/components/TreeView'

export default function StatusFilesSection({
  title,
  files,
  viewKey,
  defaultViewKey,
  repoName,
  statusMode,
  actionLabel,
  onToggle,
  enableBulk,
  onBulk
}: {
  title: string
  files: string[]
  viewKey?: string
  defaultViewKey?: string
  repoName?: string
  statusMode?: 'staged' | 'unstaged'
  actionLabel?: string
  onToggle?: (path: string) => void
  enableBulk?: boolean
  onBulk?: () => void
}) {
  const [view, setView] = useState<'list' | 'tree'>(() => {
    if (typeof window !== 'undefined') {
      if (viewKey) {
        const v = window.localStorage.getItem(viewKey)
        if (v === 'list' || v === 'tree') return v
      }
      if (defaultViewKey) {
        const d = window.localStorage.getItem(defaultViewKey)
        if (d === 'list' || d === 'tree') return d
      }
    }
    return 'tree'
  })
  const [expandSig, setExpandSig] = useState(0)
  const [collapseSig, setCollapseSig] = useState(0)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set())
  const [selected, setSelected] = useState<string | null>(null)
  const [diff, setDiff] = useState<string>('')
  const [loadingDiff, setLoadingDiff] = useState(false)
  const [diffError, setDiffError] = useState<string | null>(null)

  useEffect(() => {
    try {
      if (viewKey && typeof window !== 'undefined') window.localStorage.setItem(viewKey, view)
    } catch {}
  }, [viewKey, view])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 }}>
      <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: 0 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {enableBulk && onBulk ? (
            <input
              type="checkbox"
              aria-label={`${actionLabel || 'Apply'} all`}
              onChange={(e) => {
                e.currentTarget.checked = false
                onBulk()
              }}
              disabled={files.length === 0}
            />
          ) : null}
          <span>{title}</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {view === 'tree' && (
            <>
              <button type="button" className="view-toggle__btn" onClick={() => setExpandSig((n) => n + 1)}>Expand all</button>
              <button type="button" className="view-toggle__btn" onClick={() => setCollapseSig((n) => n + 1)}>Collapse all</button>
            </>
          )}
          <span className="view-toggle" role="tablist" aria-label={`${title} view style`}>
            <button type="button" className={`view-toggle__btn${view === 'list' ? ' is-active' : ''}`} onClick={() => setView('list')}>List</button>
            <button type="button" className={`view-toggle__btn${view === 'tree' ? ' is-active' : ''}`} onClick={() => setView('tree')}>Tree</button>
          </span>
        </span>
      </h3>
      <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
        {files.length === 0 ? (
          <div style={{ opacity: 0.7 }}>No files.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(0, 50%)', gap: 12, minHeight: 0 }}>
            <div style={{ minHeight: 0 }}>
              {view === 'list' ? (
                <GroupedListView
                  paths={files}
                  onToggle={onToggle ? (p) => onToggle(p) : undefined}
                  onFileClick={(p) => handleOpenDiff(p)}
                  actionLabel={actionLabel}
                />
              ) : (
                <TreeView
                  paths={files}
                  onToggleNode={onToggle ? (p) => onToggle(p) : undefined}
                  onFileClick={(p) => handleOpenDiff(p)}
                  actionLabel={actionLabel}
                  expandAllSignal={expandSig}
                  collapseAllSignal={collapseSig}
                  expandedPaths={expandedPaths}
                  onExpandedChange={setExpandedPaths}
                />
              )}
            </div>
            <div style={{ borderLeft: '1px solid #e5e7eb', paddingLeft: 10, overflow: 'auto', minHeight: 0 }}>
              <DiffPanel path={selected} diff={diff} loading={loadingDiff} error={diffError} onClose={() => { setSelected(null); setDiff('') }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )

  async function handleOpenDiff(path: string) {
    setSelected(path)
    if (!repoName) return
    setLoadingDiff(true)
    setDiffError(null)
    try {
      const qs = new URLSearchParams({ path, staged: String(statusMode === 'staged') })
      const res = await fetch(`/api/repositories/${encodeURIComponent(repoName)}/diff?${qs.toString()}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `Failed to load diff (${res.status})`)
      setDiff(data.diff || '')
    } catch (e: any) {
      setDiffError(e?.message || 'Failed to load diff')
    } finally {
      setLoadingDiff(false)
    }
  }
}

function DiffPanel({ path, diff, loading, error, onClose }: { path: string | null; diff: string; loading: boolean; error: string | null; onClose: () => void }) {
  if (!path) return <div style={{ opacity: 0.7 }}>Select a file to view diff…</div>
  return (
    <div style={{ display: 'grid', gap: 6, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 600 }}>Diff</div>
          <div className="tree__label">{path}</div>
        </div>
        <button type="button" onClick={onClose} className="view-toggle__btn">Close</button>
      </div>
      {loading ? (
        <div style={{ opacity: 0.7 }}>Loading diff…</div>
      ) : error ? (
        <div style={{ color: '#b91c1c' }}>Error: {error}</div>
      ) : diff ? (
        <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: '0.85rem' }}>{diff}</pre>
      ) : (
        <div style={{ opacity: 0.7 }}>No changes.</div>
      )}
    </div>
  )
}
