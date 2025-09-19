"use client"

import { useMemo, useState, useEffect } from 'react'

function buildTree(paths) {
  const root = { name: '', path: '', children: new Map() }
  for (const p of paths) {
    const parts = p.split('/').filter(Boolean)
    let cur = root
    let acc = ''
    for (let idx = 0; idx < parts.length; idx++) {
      const part = parts[idx]
      const last = idx === parts.length - 1
      acc = acc ? `${acc}/${part}` : part
      if (!cur.children) cur.children = new Map()
      let next = cur.children.get(part)
      if (!next) {
        next = { name: part, path: acc }
        cur.children.set(part, next)
      }
      cur = next
      if (last) cur.isFile = true
    }
  }
  return root
}

export default function TreeView({
  paths,
  onToggleNode,
  onFileClick,
  actionLabel,
  expandAllSignal,
  collapseAllSignal,
  expandedPaths,
  onExpandedChange
}) {
  const root = useMemo(() => buildTree(paths), [paths])
  const [expandedState, setExpandedState] = useState(() => new Set())
  const expanded = expandedPaths ?? expandedState

  function setExpanded(next) {
    if (onExpandedChange) onExpandedChange(new Set(next))
    else setExpandedState(new Set(next))
  }

  function toggle(path) {
    const next = new Set(expanded)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    setExpanded(next)
  }

  function collectFolderPaths(node, acc) {
    if (node.children && node.children.size > 0) {
      if (node.path) acc.push(node.path)
      for (const [, child] of node.children) collectFolderPaths(child, acc)
    }
  }

  // Respond to expand/collapse all signals
  useEffect(() => {
    if (typeof expandAllSignal === 'number' && expandAllSignal > 0) {
      const folders = []
      collectFolderPaths(root, folders)
      setExpanded(new Set(folders))
    }
    // Intentionally not depending on `root` so we don't reset on data refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandAllSignal])

  useEffect(() => {
    if (typeof collapseAllSignal === 'number' && collapseAllSignal > 0) {
      setExpanded(new Set())
    }
  }, [collapseAllSignal])

  return <NodeList node={root} depth={0} expanded={expanded} onToggle={toggle} onToggleNode={onToggleNode} onFileClick={onFileClick} actionLabel={actionLabel} />
}

function NodeList({ node, depth, expanded, onToggle, onToggleNode, onFileClick, actionLabel }) {
  if (!node.children || node.children.size === 0) return null
  const entries = Array.from(node.children.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  return (
    <ul className="tree" style={{ marginLeft: depth ? 12 : 0 }}>
      {entries.map(([name, child]) => {
        const isFile = !!child.isFile && (!child.children || child.children.size === 0)
        const isOpen = expanded.has(child.path)
        return (
          <li key={child.path} className="tree__item">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {onToggleNode ? (
                <input
                  type="checkbox"
                  aria-label={actionLabel || 'toggle'}
                  onChange={() => onToggleNode && onToggleNode(child.path, isFile)}
                />
              ) : null}
              {isFile ? (
                <button type="button" onClick={() => onFileClick && onFileClick(child.path)} className="tree__label" aria-label="file" style={{ background: 'transparent', border: 'none', padding: 0, margin: 0, cursor: onFileClick ? 'pointer' : 'default', textAlign: 'left' }}>📄 {name}</button>
              ) : (
              <button
                type="button"
                className="tree__folder"
                aria-expanded={isOpen}
                onClick={() => onToggle(child.path)}
              >
                <span className={`tree__caret${isOpen ? ' is-open' : ''}`} aria-hidden />
                <span className="tree__label">📁 {name}</span>
              </button>
            )}
            </div>
            {!isFile && isOpen && (
              <NodeList node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} onToggleNode={onToggleNode} onFileClick={onFileClick} actionLabel={actionLabel} />
            )}
          </li>
        )
      })}
    </ul>
  )
}
