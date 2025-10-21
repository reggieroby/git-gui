"use client"
import { useEffect, useMemo, useState } from 'react'
import CommitGraph from '@/components/CommitGraph'
import gql from '@/lib/gql'
import { Q_HISTORY, Q_REMOTES, Q_COMMIT, Q_STATUS, M_CREATE_BRANCH, M_CHECKOUT_BRANCH, M_DELETE_BRANCH, M_MERGE_BRANCH, M_PUSH_BRANCH } from '@/lib/queries'
import StatusFilesSection from '@/components/StatusFilesSection'

export default function HistorySection({ repoName }) {
  const [rows, setRows] = useState([])
  const [lanes, setLanes] = useState(1)
  const [selectedId, setSelectedId] = useState(undefined)
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [remotes, setRemotes] = useState([])
  const [remotesLoading, setRemotesLoading] = useState(false)
  const [remotesError, setRemotesError] = useState(null)
  const [headBranch, setHeadBranch] = useState(null)
  const [headUpstream, setHeadUpstream] = useState(null)
  const [switchingKey, setSwitchingKey] = useState(null)
  const [deletingKey, setDeletingKey] = useState(null)
  const [branchActionError, setBranchActionError] = useState(null)
  const [mergeMenuKey, setMergeMenuKey] = useState(null)
  const [mergeBusyKey, setMergeBusyKey] = useState(null)
  const [pushKey, setPushKey] = useState(null)
  const [httpsAuthDialog, setHttpsAuthDialog] = useState(null)
  const [forcePushDialog, setForcePushDialog] = useState(null)
  const [switchingRemote, setSwitchingRemote] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusError, setStatusError] = useState(null)
  const [repoStatus, setRepoStatus] = useState({ staged: [], unstaged: [], untrackedCount: 0, modifiedCount: 0 })

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const resp = await gql(Q_HISTORY, { name: repoName, limit: 200 }, 'RepoHistory')
        if (resp.errors?.length) throw new Error(resp.errors[0].message || 'GraphQL error')
        const data = resp.data?.history || { commits: [], maxLanes: 0 }
        if (!cancelled) {
          const commits = Array.isArray(data.commits) ? data.commits : []
          setRows(commits)
          setLanes(typeof data.maxLanes === 'number' ? data.maxLanes : 1)
          setHeadBranch(typeof data.headBranch === 'string' && data.headBranch ? data.headBranch : null)
          setHeadUpstream(typeof data.headUpstream === 'string' && data.headUpstream ? data.headUpstream : null)
          if (commits.length) setSelectedId(commits[0].id || undefined)
          else {
            setSelectedId(undefined)
            setDetail(null)
          }
        }
      } catch (e) {
        if (!cancelled) setError(e?.message ?? 'Failed to load history')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [repoName])

  useEffect(() => {
    let cancelled = false
    async function loadRemotes() {
      setRemotesLoading(true)
      setRemotesError(null)
      try {
        const resp = await gql(Q_REMOTES, { name: repoName }, 'RepoRemotes')
        const data = resp.data || {}
        if (!cancelled) {
          if (resp.errors?.length) throw new Error(resp.errors[0].message || 'Failed to load remotes')
          setRemotes(Array.isArray(data.remotes) ? data.remotes : [])
        }
      } catch (e) {
        if (!cancelled) setRemotesError(e?.message || 'Failed to load remotes')
      } finally {
        if (!cancelled) setRemotesLoading(false)
      }
    }
    loadRemotes()
    // also load status
    loadStatus()
    return () => { cancelled = true }
  }, [repoName])

  async function loadStatus() {
    setStatusLoading(true)
    setStatusError(null)
    try {
      const resp = await gql(Q_STATUS, { name: repoName }, 'Status')
      if (resp.errors?.length) throw new Error(resp.errors[0].message || 'Failed to load status')
      const data = resp.data?.status || { staged: [], unstaged: [], untrackedCount: 0, modifiedCount: 0 }
      setRepoStatus({ staged: Array.isArray(data.staged) ? data.staged : [], unstaged: Array.isArray(data.unstaged) ? data.unstaged : [], untrackedCount: Number(data.untrackedCount) || 0, modifiedCount: Number(data.modifiedCount) || 0 })
    } catch (e) {
      setStatusError(e?.message || 'Failed to load status')
    } finally {
      setStatusLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function loadDetail() {
      if (!selectedId) { setDetail(null); return }
      try {
        const resp = await gql(Q_COMMIT, { name: repoName, id: selectedId }, 'Commit')
        if (!cancelled) setDetail(resp.errors?.length ? { error: resp.errors[0].message || 'Failed to load commit' } : resp.data?.commit)
      } catch (e) {
        if (!cancelled) setDetail({ error: e?.message || 'Failed to load commit' })
      }
    }
    loadDetail()
    return () => { cancelled = true }
  }, [repoName, selectedId])

  async function refreshRemotesAndHistory({ selectHead = false } = {}) {
    try {
      const resp = await gql(Q_REMOTES, { name: repoName }, 'RepoRemotes')
      if (!resp.errors) setRemotes(Array.isArray(resp.data?.remotes) ? resp.data.remotes : [])
    } catch { }
    try { await loadStatus() } catch { }
    try {
      const resp2 = await gql(Q_HISTORY, { name: repoName, limit: 200 }, 'RepoHistory')
      if (!resp2.errors) {
        const hist = resp2.data?.history || {}
        const commits = Array.isArray(hist.commits) ? hist.commits : []
        setRows(commits)
        setLanes(Number(hist.maxLanes) || 1)
        setHeadBranch(typeof hist.headBranch === 'string' && hist.headBranch ? hist.headBranch : null)
        setHeadUpstream(typeof hist.headUpstream === 'string' && hist.headUpstream ? hist.headUpstream : null)
        if (selectHead) {
          const headRow = commits.find((c) => Array.isArray(c.labels) && c.labels.includes('HEAD'))
          if (headRow?.id) setSelectedId(headRow.id)
          else if (commits.length) setSelectedId(commits[0].id)
        }
      }
    } catch { }
  }

  const emptyState = (
    <div style={{ opacity: 0.75 }}>
      This repository has no commits yet. Make your first commit to see history here.
    </div>
  )

  const localBranchesFromHistory = useMemo(() => {
    const names = new Set()
    for (const row of rows || []) {
      if (!Array.isArray(row?.labels)) continue
      for (const label of row.labels) {
        if (typeof label !== 'string') continue
        if (label.startsWith('refs/heads/')) {
          const branch = label.slice('refs/heads/'.length)
          if (branch) names.add(branch)
        }
      }
    }
    if (typeof headBranch === 'string' && headBranch) names.add(headBranch)
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [rows, headBranch])

  const remotesForDisplay = useMemo(() => {
    const base = Array.isArray(remotes) ? remotes.filter((r) => r && typeof r.name === 'string') : []
    const normalized = base.map((r) => ({
      name: r.name,
      url: r.url || null,
      branches: Array.isArray(r.branches) ? [...new Set(r.branches.filter((b) => typeof b === 'string' && b))].sort((a, b) => a.localeCompare(b)) : [],
      branchStatuses: Array.isArray(r.branchStatuses)
        ? r.branchStatuses
            .filter((s) => s && typeof s.branch === 'string')
            .map((s) => ({
              remote: s.remote || r.name,
              branch: s.branch,
              ahead: typeof s.ahead === 'number' ? s.ahead : 0,
              behind: typeof s.behind === 'number' ? s.behind : 0
            }))
        : []
    }))
    const localIdx = normalized.findIndex((r) => r.name === 'local')
    if (localIdx >= 0) {
      const merged = new Set(normalized[localIdx].branches)
      for (const branch of localBranchesFromHistory) merged.add(branch)
      normalized[localIdx] = {
        ...normalized[localIdx],
        branches: Array.from(merged).sort((a, b) => a.localeCompare(b)),
        branchStatuses: []
      }
    } else if (localBranchesFromHistory.length) {
      normalized.unshift({ name: 'local', url: null, branches: [...localBranchesFromHistory], branchStatuses: [] })
    }
    return normalized
  }, [remotes, localBranchesFromHistory])

  const remoteBranchStatusMap = useMemo(() => {
    const map = new Map()
    for (const remote of remotesForDisplay) {
      if (!remote || remote.name === 'local') continue
      for (const status of remote.branchStatuses || []) {
        if (!status || typeof status.branch !== 'string') continue
        map.set(`${remote.name}:${status.branch}`, status)
      }
    }
    return map
  }, [remotesForDisplay])

  const localBranchesList = remotesForDisplay.find((rem) => rem.name === 'local')
  const localBranches = Array.isArray(localBranchesList?.branches) ? localBranchesList.branches : []

  if (loading) return <div style={{ opacity: 0.7 }}>Loading history…</div>
  if (error) return emptyState
  if (!rows.length) return emptyState

  return (
    <>
      <div style={{ height: '100%', minHeight: 0, display: 'grid', gridTemplateColumns: '260px 1fr 360px', gap: 16 }}>
        <aside style={{ borderRight: '1px solid #e5e7eb', paddingRight: 12, overflow: 'auto', minHeight: 0 }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Remotes</h3>
          {branchActionError && (
            <div style={{ color: '#b91c1c', marginBottom: 8 }}>{branchActionError}</div>
          )}
          {(() => {
            // Determine active local branch (HEAD -> refs/heads/<branch>) and any remote head on the same commit
            let activeLocal = null
            const activeRemoteRefs = new Set()
            const labelToId = new Map()
            for (const row of rows || []) {
              if (!Array.isArray(row?.labels)) continue
              for (const lab of row.labels) {
                if (typeof lab !== 'string') continue
                labelToId.set(lab, row.id)
                if (lab.startsWith('refs/remotes/')) {
                  const rest = lab.slice('refs/remotes/'.length)
                  if (rest) labelToId.set(rest, row.id)
                } else if (lab.startsWith('refs/heads/')) {
                  const rest = lab.slice('refs/heads/'.length)
                  if (rest) {
                    labelToId.set(`local/${rest}`, row.id)
                    labelToId.set(rest, row.id)
                  }
                }
              }
            }
            const headRow = (rows || []).find(r => Array.isArray(r.labels) && r.labels.includes('HEAD'))
            const headCommitId = headRow?.id || null
            if (headRow && Array.isArray(headRow.labels)) {
              for (const lab of headRow.labels) {
                if (typeof lab !== 'string') continue
                if (lab.startsWith('refs/heads/')) activeLocal = lab.slice('refs/heads/'.length)
                else if (lab.startsWith('refs/remotes/')) activeRemoteRefs.add(lab)
              }
            }
            // stash in closure for the list below
            if (!activeLocal && typeof headBranch === 'string' && headBranch) activeLocal = headBranch
            const upstreamRaw = typeof headUpstream === 'string' && headUpstream ? headUpstream : null
            const upstreamShort = upstreamRaw?.startsWith('refs/remotes/') ? upstreamRaw.slice('refs/remotes/'.length) : upstreamRaw
            const upstreamRef = upstreamRaw?.startsWith('refs/remotes/') ? upstreamRaw : (upstreamRaw ? `refs/remotes/${upstreamRaw}` : null)
            HistorySection.__activeLocal = activeLocal
            HistorySection.__activeRemoteRefs = activeRemoteRefs
            HistorySection.__activeUpstream = upstreamShort
            HistorySection.__activeUpstreamRef = upstreamRef
            HistorySection.__labelIndex = labelToId
            HistorySection.__headCommitId = headCommitId
            return null
          })()}
          {remotesLoading ? (
            <div style={{ opacity: 0.7 }}>Loading…</div>
          ) : remotesError ? (
            <div style={{ color: '#b91c1c' }}>Error: {remotesError}</div>
          ) : remotesForDisplay.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No remotes.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {/* Current state */}
              <div style={{ marginBottom: 8, padding: '8px', border: '1px solid #eef2ff', borderRadius: 8, background: '#fbfdff' }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Current state</div>
                {statusLoading ? (
                  <div style={{ opacity: 0.7 }}>Loading status…</div>
                ) : statusError ? (
                  <div style={{ color: '#b91c1c' }}>Error: {statusError}</div>
                ) : (
                  <div style={{ fontSize: '0.9rem', color: '#374151', display: 'grid', gap: 4 }}>
                    <div><strong>Clean:</strong> {repoStatus.staged.length === 0 && repoStatus.unstaged.length === 0 ? 'Yes' : 'No'}</div>
                    <div><strong>Staged:</strong> {repoStatus.staged.length} files</div>
                    <div><strong>Modified (unstaged):</strong> {repoStatus.modifiedCount}</div>
                    <div><strong>Untracked:</strong> {repoStatus.untrackedCount}</div>
                    <div style={{ opacity: 0.85, fontSize: '0.85rem' }}>Note: 'Modified' and 'Untracked' are derived from git porcelain output; unstaged = modified + untracked.</div>
                  </div>
                )}
              </div>
              {remotesForDisplay.map((r) => (
                <div key={r.name}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                  </div>
                  {r.name === 'local' && (
                    <AddBranchInline
                      repoName={repoName}
                      remoteName={r.name}
                      onAdded={() => { refreshRemotesAndHistory() }}
                    />
                  )}
                  <ul style={{ listStyle: 'none', paddingLeft: 0, margin: '4px 0 0 0' }}>
                    {(r.branches || []).map((b) => {
                      const key = `${r.name}:${b}`
                      const remoteLabel = `refs/remotes/${r.name}/${b}`
                      const isCurrent = r.name === 'local'
                        ? (HistorySection.__activeLocal && b === HistorySection.__activeLocal)
                        : (HistorySection.__labelIndex?.get(remoteLabel) === HistorySection.__headCommitId)
                      const isSwitching = switchingKey === key
                      const mergeOptions = r.name === 'local'
                        ? localBranches.filter((name) => typeof name === 'string' && name && name !== b)
                        : []
                      const status = r.name === 'local' ? null : remoteBranchStatusMap.get(key)
                      const renderChip = (label, bg, color) => (
                        <span
                          key={label}
                          style={{
                            fontSize: '0.7rem',
                            padding: '1px 6px',
                            borderRadius: 999,
                            background: bg,
                            color,
                            fontWeight: 500
                          }}
                        >
                          {label}
                        </span>
                      )
                      return (
                        <li
                          key={r.name + ':' + b}
                          className="tree__label"
                          style={{ padding: '2px 0', cursor: 'pointer', fontWeight: isCurrent ? 700 : 400, display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}
                          onClick={() => {
                            setBranchActionError(null)
                            const label = r.name === 'local' ? `refs/heads/${b}` : remoteLabel
                            const map = HistorySection.__labelIndex
                            let id = map?.get(label)
                            if (!id) {
                              const fallback = r.name === 'local' ? `local/${b}` : `${r.name}/${b}`
                              id = map?.get(fallback) || map?.get(b)
                            }
                            if (id) setSelectedId(id)
                          }}
                          onMouseLeave={() => { if (mergeMenuKey === key) setMergeMenuKey(null) }}
                        >
                          <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{b}</span>
                            {status ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                {status.behind > 0 ? renderChip(`${status.behind} behind`, '#fee2e2', '#991b1b') : null}
                                {status.ahead > 0 ? renderChip(`${status.ahead} ahead`, '#dbeafe', '#1e3a8a') : null}
                              </span>
                            ) : null}
                          </span>
                          {isCurrent && <span className="commit-label" style={{ marginLeft: 6 }}>current</span>}
                          {r.name === 'local' && (
                            <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                              <button
                                type="button"
                                className="view-toggle__btn"
                                style={{ padding: '2px 6px', minWidth: 0 }}
                                aria-label={`Switch to ${b}`}
                                title={`Switch to ${b}`}
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  setBranchActionError(null)
                                  setSwitchingKey(key)
                                  try {
                                    const resp = await gql(M_CHECKOUT_BRANCH, { name: repoName, branch: b, remote: null }, 'CheckoutBranch')
                                    if (resp.errors?.length) throw new Error(resp.errors[0].message || 'Failed to switch branch')
                                    const data = resp.data?.checkoutBranch
                                    if (!data?.ok) throw new Error(data?.error || 'Failed to switch branch')
                                    await refreshRemotesAndHistory({ selectHead: true })
                                    setBranchActionError(null)
                                  } catch (err) {
                                    setBranchActionError(err?.message || 'Failed to switch branch')
                                  } finally {
                                    setSwitchingKey((prev) => (prev === key ? null : prev))
                                  }
                                }}
                                disabled={isSwitching || deletingKey === key || mergeBusyKey?.startsWith(`${key}::`) || pushKey === key}
                              >
                                <span aria-hidden="true">{isSwitching ? '…' : '⇄'}</span>
                              </button>
                              <div
                                style={{ position: 'relative' }}
                                onMouseEnter={() => { if (mergeOptions.length) setMergeMenuKey(key) }}
                                onMouseLeave={() => { if (mergeMenuKey === key) setMergeMenuKey(null) }}
                              >
                                <button
                                  type="button"
                                  className="view-toggle__btn"
                                  style={{ padding: '2px 6px', minWidth: 0 }}
                                  aria-label={`Merge into ${HistorySection.__activeLocal || 'current branch'}`}
                                  title={`Merge into ${HistorySection.__activeLocal || 'current branch'}`}
                                  onClick={(e) => e.stopPropagation()}
                                  disabled={mergeOptions.length === 0 || mergeBusyKey?.startsWith(`${key}::`) || isSwitching || deletingKey === key || pushKey === key}
                                >
                                  <span aria-hidden="true">{mergeBusyKey?.startsWith(`${key}::`) ? '…' : '⤴'}</span>
                                </button>
                                {mergeMenuKey === key && mergeOptions.length > 0 && (
                                  <div
                                    style={{ position: 'absolute', top: '100%', right: 0, zIndex: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, boxShadow: '0 6px 18px rgba(15, 23, 42, 0.15)', padding: 4, display: 'grid', gap: 2, minWidth: 160 }}
                                    onMouseEnter={() => { if (mergeOptions.length) setMergeMenuKey(key) }}
                                  >
                                    {mergeOptions.map((opt) => {
                                      const menuKey = `${key}::${opt}`
                                      const busy = mergeBusyKey === menuKey
                                      return (
                                        <button
                                          key={menuKey}
                                          type="button"
                                          className="view-toggle__btn"
                                          style={{ justifyContent: 'flex-start' }}
                                          onClick={async (e) => {
                                            e.stopPropagation()
                                            setBranchActionError(null)
                                            setMergeBusyKey(menuKey)
                                            try {
                                              const resp = await gql(M_MERGE_BRANCH, { name: repoName, branch: opt, strategy: null }, 'MergeBranch')
                                              if (resp.errors?.length) throw new Error(resp.errors[0].message || 'Failed to merge branch')
                                              const data = resp.data?.mergeBranch
                                              if (!data?.ok) throw new Error(data?.error || 'Failed to merge branch')
                                              await refreshRemotesAndHistory({ selectHead: true })
                                              setBranchActionError(null)
                                              setMergeMenuKey(null)
                                            } catch (err) {
                                              setBranchActionError(err?.message || 'Failed to merge branch')
                                            } finally {
                                              setMergeBusyKey(null)
                                            }
                                          }}
                                          disabled={busy || deletingKey === key || isSwitching || pushKey === key}
                                        >
                                          {busy ? 'Merging…' : `Merge ${opt}`}
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                className="view-toggle__btn"
                                style={{ padding: '2px 6px', minWidth: 0 }}
                                aria-label={`Push ${b}`}
                                title={`Push ${b}`}
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  setBranchActionError(null)
                                  setPushKey(key)
                                  try {
                                    const resp = await gql(M_PUSH_BRANCH, { name: repoName, branch: b }, 'PushBranch')
                                    if (resp.errors?.length) throw new Error(resp.errors[0].message || 'Failed to push branch')
                                    const data = resp.data?.pushBranch
                                    if (!data?.ok) throw new Error(data?.error || 'Failed to push branch')
                                    await refreshRemotesAndHistory()
                                    setBranchActionError(null)
                                  } catch (err) {
                                    const msg = err?.message || 'Failed to push branch'
                                    // Detect common HTTPS auth error from git
                                    if (/could not read username for 'https:\/\/github.com'|could not read Username for 'https:\/\/github.com'/i.test(msg)) {
                                      // Offer dialog to switch remote to SSH
                                      setHttpsAuthDialog({ branch: b, remote: 'origin', message: msg })
                                    } else if (/non-fast-forward|tip of your current branch is behind|failed to push some refs|\[rejected\]/i.test(msg)) {
                                      // Offer to force push only after rejection
                                      setForcePushDialog({ branch: b, message: msg })
                                    } else {
                                      setBranchActionError(msg)
                                    }
                                  } finally {
                                    setPushKey((prev) => (prev === key ? null : prev))
                                  }
                                }}
                                disabled={pushKey === key || isSwitching || deletingKey === key || mergeBusyKey?.startsWith(`${key}::`)}
                              >
                                <span aria-hidden="true">{pushKey === key ? '…' : '⬆'}</span>
                              </button>
                              <button
                                type="button"
                                className="view-toggle__btn"
                                style={{ padding: '2px 6px', minWidth: 0 }}
                                aria-label={`Delete ${b}`}
                                title={`Delete ${b}`}
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  setBranchActionError(null)
                                  setDeletingKey(key)
                                  try {
                                    const resp = await gql(M_DELETE_BRANCH, { name: repoName, branch: b, remote: null }, 'DeleteBranch')
                                    if (resp.errors?.length) throw new Error(resp.errors[0].message || 'Failed to delete branch')
                                    const data = resp.data?.deleteBranch
                                    if (!data?.ok) throw new Error(data?.error || 'Failed to delete branch')
                                    await refreshRemotesAndHistory({ selectHead: true })
                                    setBranchActionError(null)
                                  } catch (err) {
                                    setBranchActionError(err?.message || 'Failed to delete branch')
                                  } finally {
                                    setDeletingKey((prev) => (prev === key ? null : prev))
                                  }
                                }}
                                disabled={deletingKey === key || isSwitching || mergeBusyKey?.startsWith(`${key}::`) || pushKey === key}
                              >
                                <span aria-hidden="true">{deletingKey === key ? '…' : '🗑'}</span>
                              </button>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </aside>
        <div style={{ minHeight: 0, height: '100%', borderLeft: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', padding: '0 12px' }}>
          <div style={{ height: '100%', minHeight: 0 }}>
            <CommitGraph
              rows={rows}
              maxLanes={lanes}
              selectedId={selectedId}
              onSelect={(r) => r?.id && setSelectedId(r.id)}
              repoName={repoName}
              onRefresh={() => refreshRemotesAndHistory({ selectHead: true })}
            />
          </div>
        </div>
        <div style={{ borderLeft: '1px solid #e5e7eb', paddingLeft: 12, overflow: 'auto', minHeight: 0 }}>
          <CommitDetail detail={detail} />
        </div>
      </div>
      {httpsAuthDialog && (
        <HttpsAuthDialog
          repoName={repoName}
          dialog={httpsAuthDialog}
          onClose={() => setHttpsAuthDialog(null)}
          onSwitched={() => { refreshRemotesAndHistory() }}
        />
      )}
      {forcePushDialog && (
        <ForcePushDialog
          repoName={repoName}
          dialog={forcePushDialog}
          onClose={() => setForcePushDialog(null)}
          onPushed={() => { setForcePushDialog(null); refreshRemotesAndHistory() }}
        />
      )}
    </>
  )
}

// Render HTTPS auth dialog near top-level of this module so it can overlay the UI
export function __HistorySectionDialogMount(props) {
  return <HttpsAuthDialog {...props} />
}

// HTTPS auth error dialog component and handlers
function HttpsAuthDialog({ repoName, dialog, onClose, onSwitched }) {
  const [busy, setBusy] = useState(false)
  if (!dialog) return null
  const remoteName = dialog.remote || 'origin'
  // derive SSH url from existing remotes list by replacing https://github.com/OWNER/REPO.git -> git@github.com:OWNER/REPO.git
  const deriveSsh = (httpsUrl) => {
    try {
      if (!httpsUrl) return null
      // strip trailing .git variants and convert
      const m = httpsUrl.match(/^https:\/\/github\.com\/(.+)$/i)
      if (!m) return null
      const path = m[1]
      return `git@github.com:${path}`
    } catch { return null }
  }

  const switchToSsh = async () => {
    setBusy(true)
    try {
      // fetch remotes to find the current origin URL
      const resp = await gql(`query RepoRemotes($name:String!){ remotes(name:$name){ name url } }`, { name: repoName }, 'RepoRemotes')
      const rem = resp.data?.remotes || []
      const origin = rem.find(r => r.name === remoteName)
      const httpsUrl = origin?.url || null
      const sshUrl = deriveSsh(httpsUrl)
      if (!sshUrl) throw new Error('Cannot derive SSH URL from remote')
      const setResp = await gql(`mutation SetRemoteUrl($name:String!,$remote:String!,$url:String!){ setRemoteUrl(name:$name, remote:$remote, url:$url){ ok error } }`, { name: repoName, remote: remoteName, url: sshUrl }, 'SetRemoteUrl')
      const ok = setResp.data?.setRemoteUrl?.ok
      const err = setResp.data?.setRemoteUrl?.error || (setResp.errors && setResp.errors[0]?.message)
      if (!ok) throw new Error(err || 'Failed to set remote URL')
      if (onSwitched) onSwitched()
      onClose()
    } catch (e) {
      alert(e?.message || 'Failed to switch remote')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="commit-rail__dialog-backdrop" role="presentation" onClick={() => !busy && onClose()}>
      <div className="commit-rail__dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3>Authentication required to push</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          <p style={{ marginTop: 0 }}>Git returned the following error when trying to push:</p>
          <pre className="commit-error__message">{dialog.message}</pre>
          <p>
            It looks like the repository remote is an HTTPS URL and the server cannot prompt for credentials. We recommend switching the remote to the SSH URL for GitHub and retrying the push.
          </p>
          <p style={{ margin: 0 }}>
            The action below will attempt to convert <code>{remoteName}</code> to the SSH form (for example <code>git@github.com:OWNER/REPO.git</code>).
          </p>
        </div>
        <div className="commit-rail__dialog-actions">
          <button type="button" className="commit-rail__dialog-btn is-secondary" onClick={() => onClose()} disabled={busy}>Close</button>
          <button type="button" className="commit-rail__dialog-btn" onClick={() => switchToSsh()} disabled={busy}>{busy ? 'Switching…' : 'Switch to SSH & retry'}</button>
        </div>
      </div>
    </div>
  )
}

// Force push confirmation dialog
function ForcePushDialog({ repoName, dialog, onClose, onPushed }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  if (!dialog) return null
  const branch = dialog.branch

  const doForcePush = async () => {
    setBusy(true)
    setErr(null)
    try {
      const resp = await gql(M_PUSH_BRANCH, { name: repoName, branch, force: true }, 'PushBranch')
      if (resp.errors?.length) throw new Error(resp.errors[0].message || 'Failed to force push')
      const data = resp.data?.pushBranch
      if (!data?.ok) throw new Error(data?.error || 'Failed to force push')
      if (onPushed) onPushed()
      else onClose()
    } catch (e) {
      setErr(e?.message || 'Failed to force push')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="commit-rail__dialog-backdrop" role="presentation" onClick={() => !busy && onClose()}>
      <div className="commit-rail__dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3>Force push required?</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          <p style={{ marginTop: 0 }}>The push was rejected with a non-fast-forward error:</p>
          <pre className="commit-error__message">{dialog.message}</pre>
          <p style={{ margin: 0 }}>
            You can force push <code>{branch}</code> to overwrite the remote history. This uses <code>--force-with-lease</code> to avoid clobbering unseen updates.
          </p>
          {err && <div className="commit-rail__dialog-error">{err}</div>}
        </div>
        <div className="commit-rail__dialog-actions">
          <button type="button" className="commit-rail__dialog-btn is-secondary" onClick={() => doForcePush()} disabled={busy}>{busy ? 'Force pushing…' : 'Force push'}</button>
          <button type="button" className="commit-rail__dialog-btn" onClick={() => onClose()} disabled={busy}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function AddBranchInline({ repoName, remoteName, onAdded }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  async function add() {
    const branch = name.trim()
    if (!branch) return
    setBusy(true)
    setErr(null)
    try {
      const resp = await gql(M_CREATE_BRANCH, { name: repoName, remote: remoteName, branch }, 'CreateBranch')
      const data = resp.data?.createBranch
      if (resp.errors?.length || !data?.ok) throw new Error(data?.pushError || resp.errors?.[0]?.message || 'Failed')
      setName('')
      if (onAdded) onAdded()
    } catch (e) {
      setErr(e?.message || 'Failed to add branch')
    } finally {
      setBusy(false)
    }
  }

  // HTTPS auth dialog UI rendering at end of file
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="new-branch-name"
        style={{ flex: 1, minWidth: 0, padding: '4px 6px', border: '1px solid #e5e7eb', borderRadius: 6 }}
        disabled={busy}
        onKeyDown={(e) => { if (e.key === 'Enter') add() }}
      />
      <button type="button" className="view-toggle__btn" onClick={add} disabled={busy || !name.trim()}>
        {busy ? 'Adding…' : 'Add'}
      </button>
      {err && <div style={{ color: '#b91c1c', fontSize: '0.8rem' }}>{err}</div>}
    </div>
  )
}

function CommitDetail({ detail }) {
  if (!detail) return <div style={{ opacity: 0.7 }}>Select a commit…</div>
  if (detail.error) return <div style={{ color: '#b91c1c' }}>Error: {detail.error}</div>
  const d = detail
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div>
        <div style={{ fontWeight: 600 }}>Commit</div>
        <code className="tree__label">{d.id}</code>
      </div>
      <div>
        <div style={{ fontWeight: 600 }}>Author</div>
        <div className="tree__label">{d.author?.name} &lt;{d.author?.email}&gt;</div>
        <div style={{ opacity: 0.75, fontSize: '0.85rem' }}>{formatDate(d.author?.date)}</div>
      </div>
      <div>
        <div style={{ fontWeight: 600 }}>Committer</div>
        <div className="tree__label">{d.committer?.name} &lt;{d.committer?.email}&gt;</div>
        <div style={{ opacity: 0.75, fontSize: '0.85rem' }}>{formatDate(d.committer?.date)}</div>
      </div>
      <div>
        <div style={{ fontWeight: 600 }}>Subject</div>
        <div>{d.subject}</div>
      </div>
      {d.body && (
        <div>
          <div style={{ fontWeight: 600 }}>Body</div>
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{d.body}</pre>
        </div>
      )}
      {Array.isArray(d.parents) && d.parents.length > 0 && (
        <div>
          <div style={{ fontWeight: 600 }}>Parents</div>
          <div style={{ display: 'grid' }}>
            {d.parents.map((p) => (
              <code key={p} className="tree__label">{p}</code>
            ))}
          </div>
        </div>
      )}
      {Array.isArray(d.files) && (
        <div style={{ marginTop: 8, minHeight: 0 }}>
          <StatusFilesSection title="Files" files={d.files} defaultViewKey={'prefs:fileStatusDefaultView'} />
        </div>
      )}
    </div>
  )
}

function formatDate(v) {
  if (!v) return ''
  try { return new Date(v).toLocaleString() } catch { return v }
}

// gql helper centralized in src/lib/gql
