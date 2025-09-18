"use client"
import { useEffect, useState } from 'react'
import GroupedListView from '@/components/GroupedListView'
import TreeView from '@/components/TreeView'
import gql from '@/lib/gql'
import { Q_SETTINGS, Q_DIFF } from '@/lib/queries'

export default function StatusFilesSection({
  title,
  files,
  viewKey,
  repoName,
  statusMode,
  usePreferences,
  actionLabel,
  onToggle,
  enableBulk,
  onBulk
}) {
  const [view, setView] = useState(() => 'tree')
  const [expandSig, setExpandSig] = useState(0)
  const [collapseSig, setCollapseSig] = useState(0)
  const [expandedPaths, setExpandedPaths] = useState(() => new Set())
  const [selected, setSelected] = useState(null)
  const [diff, setDiff] = useState('')
  const [loadingDiff, setLoadingDiff] = useState(false)
  const [diffError, setDiffError] = useState(null)

  // Persist view if a key is provided (optional); currently unused by callers
  useEffect(() => {
    try {
      if (viewKey && typeof window !== 'undefined') window.localStorage.setItem(viewKey, view)
    } catch {}
  }, [viewKey, view])

  // Apply user preferences (hierarchical) as initial state
  useEffect(() => {
    let cancelled = false
    if (!usePreferences) return
    ;(async () => {
      try {
        const resp = await gql(Q_SETTINGS, {}, 'Settings')
        if (resp.errors?.length) return
        const all = (resp.data && resp.data.settings) || {}
        const scope = statusMode ? `file status/ ${statusMode}/` : 'file status/'
        const get = (k) => {
          const specific = `${scope} ${k}`
          const parent = `file status/ ${k}`
          return (all[specific] ?? all[parent] ?? '').toString().trim().toLowerCase()
        }
        const prefView = get('file view') // 'tree' | 'list' | ''
        const prefExpand = get('expansion state') // 'expanded' | 'collapsed' | ''
        if (!cancelled) {
          if (prefView === 'tree' || prefView === 'list') setView(prefView)
          if (prefExpand === 'expanded') setExpandSig((n) => n + 1)
          if (prefExpand === 'collapsed') setCollapseSig((n) => n + 1)
        }
      } catch {}
    })()
    return () => { cancelled = true }
  }, [usePreferences, statusMode])

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

  async function handleOpenDiff(path) {
    setSelected(path)
    if (!repoName) return
    setLoadingDiff(true)
    setDiffError(null)
    try {
      const resp = await gql(Q_DIFF, { name: repoName, path, staged: statusMode === 'staged' }, 'Diff')
      if (resp.errors?.length) throw new Error(resp.errors[0].message || 'Failed to load diff')
      setDiff(resp.data?.diff?.text || '')
    } catch (e) {
      setDiffError(e?.message || 'Failed to load diff')
    } finally {
      setLoadingDiff(false)
    }
  }
}

function DiffPanel({ path, diff, loading, error, onClose }) {
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
