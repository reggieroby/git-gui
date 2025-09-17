"use client"
import { useEffect, useState } from 'react'
import GroupedListView from '@/components/GroupedListView'
import TreeView from '@/components/TreeView'

export default function StatusFilesSection({
  title,
  files,
  viewKey,
  defaultViewKey,
  actionLabel,
  onToggle,
  enableBulk,
  onBulk
}: {
  title: string
  files: string[]
  viewKey?: string
  defaultViewKey?: string
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
        ) : view === 'list' ? (
          <GroupedListView paths={files} onToggle={onToggle ? (p) => onToggle(p) : undefined} actionLabel={actionLabel} />
        ) : (
          <TreeView
            paths={files}
            onToggleNode={onToggle ? (p) => onToggle(p) : undefined}
            actionLabel={actionLabel}
            expandAllSignal={expandSig}
            collapseAllSignal={collapseSig}
            expandedPaths={expandedPaths}
            onExpandedChange={setExpandedPaths}
          />
        )}
      </div>
    </div>
  )
}
