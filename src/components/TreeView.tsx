"use client"

import { useMemo, useState, useEffect } from 'react'

type Node = {
  name: string
  path: string
  children?: Map<string, Node>
  isFile?: boolean
}

function buildTree(paths: string[]): Node {
  const root: Node = { name: '', path: '', children: new Map() }
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
  actionLabel,
  expandAllSignal,
  collapseAllSignal,
  expandedPaths,
  onExpandedChange
}: {
  paths: string[]
  onToggleNode?: (path: string, isFile: boolean) => void
  actionLabel?: string
  expandAllSignal?: number
  collapseAllSignal?: number
  expandedPaths?: Set<string>
  onExpandedChange?: (next: Set<string>) => void
}) {
  const root = useMemo(() => buildTree(paths), [paths])
  const [expandedState, setExpandedState] = useState<Set<string>>(() => new Set<string>())
  const expanded = expandedPaths ?? expandedState

  function setExpanded(next: Set<string>) {
    if (onExpandedChange) onExpandedChange(new Set(next))
    else setExpandedState(new Set(next))
  }

  function toggle(path: string) {
    const next = new Set(expanded)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    setExpanded(next)
  }

  function collectFolderPaths(node: Node, acc: string[]) {
    if (node.children && node.children.size > 0) {
      if (node.path) acc.push(node.path)
      for (const [, child] of node.children) collectFolderPaths(child, acc)
    }
  }

  // Respond to expand/collapse all signals
  useEffect(() => {
    if (typeof expandAllSignal === 'number' && expandAllSignal > 0) {
      const folders: string[] = []
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

  return <NodeList node={root} depth={0} expanded={expanded} onToggle={toggle} onToggleNode={onToggleNode} actionLabel={actionLabel} />
}

function NodeList({ node, depth, expanded, onToggle, onToggleNode, actionLabel }: { node: Node; depth: number; expanded: Set<string>; onToggle: (p: string) => void; onToggleNode?: (path: string, isFile: boolean) => void; actionLabel?: string }) {
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
                <span className="tree__label" aria-label="file">📄 {name}</span>
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
              <NodeList node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} onToggleNode={onToggleNode} actionLabel={actionLabel} />
            )}
          </li>
        )
      })}
    </ul>
  )
}
