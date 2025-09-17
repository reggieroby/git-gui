"use client"
import { useEffect, useState } from 'react'
import CommitGraph from '@/components/CommitGraph'

export default function HistorySection({ repoName }: { repoName: string }) {
  const [rows, setRows] = useState<{ short: string; lane: number }[]>([])
  const [lanes, setLanes] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          setRows(Array.isArray(data.commits) ? data.commits : [])
          setLanes(typeof data.maxLanes === 'number' ? data.maxLanes : 1)
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load history')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [repoName])

  if (loading) return <div style={{ opacity: 0.7 }}>Loading history…</div>
  if (error) return <div style={{ color: '#b91c1c' }}>Error: {error}</div>
  if (!rows.length) return <div style={{ opacity: 0.7 }}>No commits to display.</div>

  return <CommitGraph rows={rows} maxLanes={lanes} />
}

