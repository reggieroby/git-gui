"use client"
import React, { useEffect, useMemo, useRef, useState } from 'react'
import gql from '@/lib/gql'
import { M_REBASE_SQUASH } from '@/lib/queries'

const LANE_SPACING = 160
const NODE_RADIUS = 7
const TOP_PADDING = 50
const BOTTOM_PADDING = 60
const ROW_SPACING = 90
const LANE_OFFSET = 40

export default function CommitGraph({ rows, maxLanes, selectedId, onSelect, repoName, onRefresh }) {
  const rowRefs = useRef(new Map())
  const [menuOpenId, setMenuOpenId] = useState(null)
  const [menuError, setMenuError] = useState(null)
  const [dialogInfo, setDialogInfo] = useState(null)
  const [dialogBusy, setDialogBusy] = useState(false)
  const [dialogError, setDialogError] = useState(null)

  const processed = useMemo(() => {
    return (rows || []).map((row, idx) => {
      const lane = Math.max(0, Math.min((Number(row.lane) || 0), Math.max(0, Number(maxLanes) - 1)))
      const x = lane * LANE_SPACING + LANE_OFFSET
      const y = TOP_PADDING + idx * ROW_SPACING
      const labels = Array.isArray(row.labels) ? row.labels : []
      const localHeads = labels
        .filter((l) => typeof l === 'string' && l.startsWith('refs/heads/'))
        .map((l) => l.slice('refs/heads/'.length))
      const isHead = labels.includes('HEAD')
      return {
        raw: row,
        id: row.id,
        lane,
        x,
        y,
        index: idx,
        short: row.short || (row.id || '').slice(0, 7),
        labels,
        localHeads,
        isHead,
        message: row.message || '',
        parents: Array.isArray(row.parents) ? row.parents : []
      }
    })
  }, [rows, maxLanes])

  const commitById = useMemo(() => {
    const map = new Map()
    processed.forEach((c) => map.set(c.id, c))
    return map
  }, [processed])

  const laneCount = processed.reduce((acc, c) => Math.max(acc, c.lane + 1), 0)
  const svgWidth = Math.max(laneCount * LANE_SPACING + LANE_OFFSET * 2, 320)
  const svgHeight = processed.length ? TOP_PADDING + (processed.length - 1) * ROW_SPACING + BOTTOM_PADDING : 0

  const connectors = useMemo(() => {
    const paths = []
    processed.forEach((commit) => {
      commit.parents.forEach((pid) => {
        const parent = commitById.get(pid)
        if (!parent) return
        const midY = (commit.y + parent.y) / 2
        const path = `M ${commit.x} ${commit.y} C ${commit.x} ${midY}, ${parent.x} ${midY}, ${parent.x} ${parent.y}`
        paths.push({ id: `${commit.id}:${pid}`, path })
      })
    })
    return paths
  }, [processed, commitById])

  useEffect(() => () => { rowRefs.current.clear() }, [])

  useEffect(() => {
    if (!selectedId) return
    const el = rowRefs.current.get(selectedId)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [selectedId])

  useEffect(() => {
    function handleClick() { setMenuOpenId(null) }
    function handleKey(e) { if (e.key === 'Escape') setMenuOpenId(null) }
    if (menuOpenId) {
      window.addEventListener('click', handleClick)
      window.addEventListener('keydown', handleKey)
    }
    return () => {
      window.removeEventListener('click', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [menuOpenId])

  async function runRebase(baseId, finalMessage) {
    setDialogBusy(true)
    setDialogError(null)
    try {
      const resp = await gql(M_REBASE_SQUASH, { name: repoName, base: baseId, message: finalMessage }, 'RebaseSquash')
      if (resp.errors?.length) throw new Error(resp.errors[0].message || 'Failed to rebase & squash')
      const data = resp.data?.rebaseSquash
      if (!data?.ok) throw new Error(data?.error || 'Failed to rebase & squash')
      if (typeof onRefresh === 'function') await onRefresh()
      setMenuOpenId(null)
      setDialogInfo(null)
    } catch (e) {
      setDialogError(e?.message || 'Failed to rebase & squash')
    } finally {
      setDialogBusy(false)
    }
  }

  function handleRowClick(commit) {
    if (typeof onSelect === 'function') onSelect(commit.raw)
  }

  return (
    <div className="commit-rail">
      <div className="commit-rail__inner">
        {menuError && (
          <div className="commit-rail__error">{menuError}</div>
        )}
        <div className="commit-rail__viewport">
          <svg
            className="commit-rail__svg"
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          >
            {connectors.map((conn) => (
              <path key={conn.id} d={conn.path} className="commit-rail__connector" />
            ))}
            {processed.map((commit) => (
              <circle
                key={`${commit.id}-node`}
                cx={commit.x}
                cy={commit.y}
                r={NODE_RADIUS}
                className={`commit-rail__node${selectedId === commit.id ? ' is-selected' : ''}`}
              />
            ))}
          </svg>
          <div className="commit-rail__rows">
            {processed.map((commit) => (
              <div
                key={`${commit.id}-row`}
                className={`commit-rail__row${selectedId === commit.id ? ' is-selected' : ''}`}
                style={{ transform: `translateY(${commit.y - ROW_SPACING / 2}px)` }}
                ref={(el) => {
                  if (!el) { rowRefs.current.delete(commit.id); return }
                  rowRefs.current.set(commit.id, el)
                }}
                onClick={() => handleRowClick(commit)}
              >
                <div className="commit-rail__row-content" style={{ marginLeft: commit.x + 20 }}>
                  <code className="commit-rail__hash">{commit.short}</code>
                  {(commit.isHead || commit.localHeads.length > 0) && (
                    <span className="commit-rail__labels">
                      {commit.isHead && <span className="commit-label">HEAD</span>}
                      {commit.localHeads.map((name) => (
                        <span key={`${commit.id}-local-${name}`} className="commit-label">
                          {name}
                        </span>
                      ))}
                    </span>
                  )}
                  <span className="commit-rail__message">{commit.message}</span>
                  <div className="commit-rail__menu" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="commit-rail__menu-button"
                      aria-label="Commit actions"
                      onClick={() => {
                        setMenuError(null)
                        setMenuOpenId((prev) => (prev === commit.id ? null : commit.id))
                      }}
                    >
                      ⋮
                    </button>
                    {menuOpenId === commit.id && (
                      <div className="commit-rail__menu-panel">
                        <button
                          type="button"
                          className="commit-rail__menu-item"
                          onClick={() => {
                            if (!repoName) {
                              setMenuError('Unknown repository context')
                              return
                            }
                            const defaultMessage = buildDefaultSquashMessage(commit.id, processed)
                            setMenuOpenId(null)
                            setDialogError(null)
                            setDialogInfo({ id: commit.id, message: defaultMessage })
                          }}
                        >
                          Rebase & squash
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {dialogInfo && (
        <div className="commit-rail__dialog-backdrop" onClick={() => !dialogBusy && setDialogInfo(null)}>
          <div className="commit-rail__dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Rebase & squash</h3>
            <p style={{ margin: '0 0 8px 0', opacity: 0.75 }}>Provide the commit message that will replace the squashed commits.</p>
            <textarea
              value={dialogInfo.message}
              onChange={(e) => setDialogInfo({ ...dialogInfo, message: e.target.value })}
              disabled={dialogBusy}
              rows={6}
              className="commit-rail__dialog-textarea"
            />
            {dialogError && <div className="commit-rail__dialog-error">{dialogError}</div>}
            <div className="commit-rail__dialog-actions">
              <button
                type="button"
                className="commit-rail__dialog-btn is-secondary"
                onClick={() => !dialogBusy && setDialogInfo(null)}
                disabled={dialogBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="commit-rail__dialog-btn"
                onClick={() => {
                  const trimmed = (dialogInfo.message || '').trim()
                  if (!trimmed) {
                    setDialogError('Commit message required for squash rebase')
                    return
                  }
                  if (!repoName) {
                    setDialogError('Unknown repository context')
                    return
                  }
                  runRebase(dialogInfo.id, trimmed)
                }}
                disabled={dialogBusy}
              >
                {dialogBusy ? 'Rebasing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function buildDefaultSquashMessage(baseId, commits) {
  const list = buildCommitListAfterBase(baseId, commits)
  if (!list.length) return ''
  const first = list[0]
  const rest = list.slice(1)
  let message = first.raw.message || first.short
  if (rest.length) {
    const bullets = rest.map((c) => `- ${c.raw.message || c.short}`).join('\n')
    message += `\n\nSquashed commits:\n${bullets}`
  }
  return message
}

function buildCommitListAfterBase(baseId, commits) {
  if (!Array.isArray(commits) || !commits.length) return []
  const index = commits.findIndex((c) => c.id === baseId)
  if (index === -1) return []
  const newer = commits.slice(0, index)
  return newer.slice().reverse()
}

function formatRemoteLabel(l) {
  const s = String(l || '')
  if (s === 'HEAD') return 'HEAD'
  if (s.startsWith('refs/heads/')) return s.slice('refs/heads/'.length)
  if (s.startsWith('refs/remotes/')) {
    const rest = s.slice('refs/remotes/'.length)
    const idx = rest.indexOf('/')
    if (idx === -1) return `[remote]/[${rest}]`
    const remote = rest.slice(0, idx)
    const branch = rest.slice(idx + 1)
    return `[${remote}]/[${branch}]`
  }
  const idx = s.indexOf('/')
  if (idx === -1) return `[${s}]`
  const remote = s.slice(0, idx)
  const branch = s.slice(idx + 1)
  return `[${remote}]/[${branch}]`
}
