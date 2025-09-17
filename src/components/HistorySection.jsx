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
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, minHeight: 0 }}>
      <div style={{ overflow: 'auto', minHeight: 0 }}>
        <CommitGraph rows={rows} maxLanes={lanes} selectedId={selectedId} onSelect={(r) => setSelectedId(r.id)} />
      </div>
      <div style={{ borderLeft: '1px solid #e5e7eb', paddingLeft: 12, overflow: 'auto', minHeight: 0 }}>
        <CommitDetail detail={detail} />
      </div>
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
