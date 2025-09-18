"use client"
import { useEffect, useState } from 'react'
import CommitGraph from '@/components/CommitGraph'
import { useMemo } from 'react'
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

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/repositories/${encodeURIComponent(repoName)}/history`, { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok && data?.error) throw new Error(data.error)
        if (!res.ok) throw new Error(`Failed to load history (${res.status})`)
        if (!cancelled) {
          const commits = Array.isArray(data.commits) ? data.commits : []
          setRows(commits)
          setLanes(typeof data.maxLanes === 'number' ? data.maxLanes : 1)
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
        const res = await fetch(`/api/repositories/${encodeURIComponent(repoName)}/remotes`, { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (!cancelled) {
          if (!res.ok) throw new Error(data?.error || `Failed to load remotes (${res.status})`)
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
        const res = await fetch(`/api/repositories/${encodeURIComponent(repoName)}/commit/${encodeURIComponent(selectedId)}`, { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (!cancelled) setDetail(res.ok ? data : { error: data?.error || `Failed to load ${res.status}` })
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
                            const res = await fetch(`/api/repositories/${encodeURIComponent(repoName)}/remotes`, { cache: 'no-store' })
                            const data = await res.json().catch(() => ({}))
                            if (res.ok) setRemotes(Array.isArray(data.remotes) ? data.remotes : [])
                          } catch {}
                        })()
                      }}
                    />
                  )}
                  <ul style={{ listStyle: 'none', paddingLeft: 0, margin: '4px 0 0 0' }}>
                    {(r.branches || []).map((b) => (
                      <li key={r.name + ':' + b} className="tree__label" style={{ padding: '2px 0' }}>▸ {b}</li>
                    ))}
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
      const res = await fetch(`/api/repositories/${encodeURIComponent(repoName)}/remotes/${encodeURIComponent(remoteName)}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.error) throw new Error(data?.error || `Failed (${res.status})`)
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
