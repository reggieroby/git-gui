"use client"
import { useEffect, useState } from 'react'
import CommitGraph from '@/components/CommitGraph'
import gql from '@/lib/gql'
import { Q_HISTORY, Q_REMOTES, Q_COMMIT, M_CREATE_BRANCH } from '@/lib/queries'
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
    return () => { cancelled = true }
  }, [repoName])

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

  if (loading) return <div style={{ opacity: 0.7 }}>Loading history…</div>
  if (error) return <div style={{ color: '#b91c1c' }}>Error: {error}</div>
  if (!rows.length) return <div style={{ opacity: 0.7 }}>No commits to display.</div>

  return (
    <div style={{ height: '100%', minHeight: 0, display: 'grid', gridTemplateColumns: '260px 1fr 360px', gap: 16 }}>
      <aside style={{ borderRight: '1px solid #e5e7eb', paddingRight: 12, overflow: 'auto', minHeight: 0 }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Remotes</h3>
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
            return null
          })()}
          {remotesLoading ? (
            <div style={{ opacity: 0.7 }}>Loading…</div>
          ) : remotesError ? (
            <div style={{ color: '#b91c1c' }}>Error: {remotesError}</div>
          ) : remotes.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No remotes.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {remotes.map((r) => (
                <div key={r.name}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                  </div>
                  {r.name === 'local' && (
                    <AddBranchInline
                      repoName={repoName}
                      remoteName={r.name}
                      onAdded={() => {
                        (async () => {
                          try {
                            const resp = await gql(Q_REMOTES, { name: repoName }, 'RepoRemotes')
                            if (!resp.errors) setRemotes(Array.isArray(resp.data?.remotes) ? resp.data.remotes : [])
                          } catch {}
                          try {
                            const resp2 = await gql(Q_HISTORY, { name: repoName, limit: 200 }, 'RepoHistory')
                            if (!resp2.errors) {
                              const commits = Array.isArray(resp2.data?.history?.commits) ? resp2.data.history.commits : []
                              setRows(commits)
                              setLanes(Number(resp2.data?.history?.maxLanes) || 1)
                              const hist = resp2.data?.history || {}
                              setHeadBranch(typeof hist.headBranch === 'string' && hist.headBranch ? hist.headBranch : null)
                              setHeadUpstream(typeof hist.headUpstream === 'string' && hist.headUpstream ? hist.headUpstream : null)
                            }
                          } catch {}
                        })()
                      }}
                    />
                  )}
                  <ul style={{ listStyle: 'none', paddingLeft: 0, margin: '4px 0 0 0' }}>
                    {(r.branches || []).map((b) => {
                      const remoteLabel = `refs/remotes/${r.name}/${b}`
                      const upstreamShort = HistorySection.__activeUpstream
                      const upstreamRef = HistorySection.__activeUpstreamRef
                      const isTracking = r.name !== 'local' && upstreamShort && (upstreamShort === `${r.name}/${b}` || upstreamRef === remoteLabel)
                      const isCurrent = r.name === 'local'
                        ? (HistorySection.__activeLocal && b === HistorySection.__activeLocal)
                        : (HistorySection.__activeRemoteRefs?.has(remoteLabel) || isTracking)
                      return (
                      <li
                        key={r.name + ':' + b}
                        className="tree__label"
                        style={{ padding: '2px 0', cursor: 'pointer', fontWeight: isCurrent ? 700 : 400 }}
                        onClick={() => {
                          const label = r.name === 'local' ? `refs/heads/${b}` : remoteLabel
                          const map = HistorySection.__labelIndex
                          let id = map?.get(label)
                          if (!id) {
                            const fallback = r.name === 'local' ? `local/${b}` : `${r.name}/${b}`
                            id = map?.get(fallback) || map?.get(b)
                          }
                          if (id) setSelectedId(id)
                        }}
                      >
                        {b}
                        {isCurrent && <span className="commit-label" style={{ marginLeft: 6 }}>current</span>}
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
          />
        </div>
      </div>
      <div style={{ borderLeft: '1px solid #e5e7eb', paddingLeft: 12, overflow: 'auto', minHeight: 0 }}>
        <CommitDetail detail={detail} />
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
          <StatusFilesSection title="Files" files={d.files} />
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
