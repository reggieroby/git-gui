"use client"
import { useEffect, useState } from 'react'
import gql from '@/lib/gql'
import { Q_GLOBAL_CONFIG, M_SET_GLOBAL_CONFIG, Q_REPO_CONFIG, M_SET_REPO_CONFIG } from '@/lib/queries'

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
        const resp = await gql(Q_GLOBAL_CONFIG, {}, 'GlobalConfig')
        if (resp.errors?.length) throw new Error(resp.errors[0].message || 'Failed to load')
        const data = resp.data?.globalConfig || {}
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
      const resp = await gql(M_SET_GLOBAL_CONFIG, partial, 'SetGlobalConfig')
      if (resp.errors?.length) throw new Error(resp.errors[0].message || 'Failed to save')
      const data = resp.data?.setGlobalConfig || {}
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
        const resp = await gql(Q_REPO_CONFIG, { name: repoName }, 'RepoConfig')
        if (resp.errors?.length) throw new Error(resp.errors[0].message || 'Failed to load')
        const data = resp.data?.repoConfig || {}
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
      const vars = { name: repoName, email: partial.email, userName: partial.name }
      const resp = await gql(M_SET_REPO_CONFIG, vars, 'SetRepoConfig')
      if (resp.errors?.length) throw new Error(resp.errors[0].message || 'Failed to save')
      const data = resp.data?.setRepoConfig || {}
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
