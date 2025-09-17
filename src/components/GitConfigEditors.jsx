"use client"
import { useEffect, useState } from 'react'

export function GlobalConfigEditor() {
  const [cfg, setCfg] = useState({ email: null, name: null })
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/config/global', { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || `Failed to load (${res.status})`)
        if (!cancelled) {
          setCfg({ email: data.email ?? null, name: data.name ?? null })
          setEmail(data.email ?? '')
          setName(data.name ?? '')
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load')
      }
    })()
    return () => { cancelled = true }
  }, [])

  async function save(partial) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/config/global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial)
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `Failed to save (${res.status})`)
      setCfg({ email: data.email ?? null, name: data.name ?? null })
      setEmail(data.email ?? '')
      setName(data.name ?? '')
    } catch (e) {
      setError(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 8, maxWidth: 640 }}>
      <h3 style={{ margin: 0 }}>Global</h3>
      {error && <div style={{ color: '#b91c1c' }}>Error: {error}</div>}
      <label style={{ display: 'grid', gap: 4 }}>
        <span className="tree__label">user.email</span>
        <input
          type="text"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          onBlur={(e) => save({ email: e.target.value })}
          disabled={saving}
          style={{ padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6 }}
        />
      </label>
      <label style={{ display: 'grid', gap: 4 }}>
        <span className="tree__label">user.name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your Name"
          onBlur={(e) => save({ name: e.target.value })}
          disabled={saving}
          style={{ padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6 }}
        />
      </label>
    </div>
  )
}
export function RepoConfigEditor({ repoName }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/repositories/${encodeURIComponent(repoName)}/config`, { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || `Failed to load (${res.status})`)
        if (!cancelled) {
          setEmail(data.email ?? '')
          setName(data.name ?? '')
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [repoName])

  async function save(partial) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/repositories/${encodeURIComponent(repoName)}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial)
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `Failed to save (${res.status})`)
      setEmail(data.email ?? '')
      setName(data.name ?? '')
    } catch (e) {
      setError(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {error && <div style={{ color: '#b91c1c' }}>Error: {error}</div>}
      <label style={{ display: 'grid', gap: 4 }}>
        <span className="tree__label">user.email</span>
        <input
          type="text"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          onBlur={(e) => save({ email: e.target.value })}
          disabled={saving || loading}
          style={{ padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6 }}
        />
      </label>
      <label style={{ display: 'grid', gap: 4 }}>
        <span className="tree__label">user.name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your Name"
          onBlur={(e) => save({ name: e.target.value })}
          disabled={saving || loading}
          style={{ padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6 }}
        />
      </label>
    </div>
  )
}
