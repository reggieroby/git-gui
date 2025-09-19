"use client"
import { useEffect, useState } from 'react'
import gql from '@/lib/gql'
import { Q_SETTINGS, M_SET_SETTING, Q_REPOSITORIES } from '@/lib/queries'

export default function UserPreferences() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 900 }}>
      <h2 style={{ margin: 0 }}>User Preferences</h2>
      <HierarchicalPrefs />
    </div>
  )
}

function HierarchicalPrefs() {
  const [settings, setSettings] = useState({})
  const [savingKey, setSavingKey] = useState(null)
  const [repos, setRepos] = useState([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const resp = await gql(Q_SETTINGS, {}, 'Settings')
        if (!cancelled && !resp.errors) setSettings(resp.data?.settings || {})
      } catch {}
      try {
        const resp = await gql(Q_REPOSITORIES, {}, 'Repositories')
        if (!cancelled && !resp.errors && Array.isArray(resp.data?.repositories)) setRepos(resp.data.repositories.map((r) => ({ name: r.name, path: r.path })))
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])

  async function postSetting(key, value) {
    const resp = await gql(M_SET_SETTING, { key, value }, 'SetSetting')
    if (resp.errors?.length) throw new Error(resp.errors[0].message || `Failed to save ${key}`)
    return resp.data?.setSetting?.value
  }

  async function save(key, value) {
    setSavingKey(key)
    try {
      const savedValue = await postSetting(key, value)
      setSettings((prev) => ({ ...prev, [key]: savedValue }))

      // If the top-level File Status preferences are edited, switch staged/unstaged to inherit
      if (key === KV.fsView) {
        const childKeys = [KV.stgView, KV.ustView]
        await Promise.all(childKeys.map((k) => postSetting(k, '')))
        setSettings((prev) => ({ ...prev, [KV.stgView]: '', [KV.ustView]: '' }))
      }
      if (key === KV.fsExpand) {
        const childKeys = [KV.stgExpand, KV.ustExpand]
        await Promise.all(childKeys.map((k) => postSetting(k, '')))
        setSettings((prev) => ({ ...prev, [KV.stgExpand]: '', [KV.ustExpand]: '' }))
      }
    } catch (_) {
      // noop; UI remains on previous value
    } finally {
      setSavingKey(null)
    }
  }

  const KV = {
    fsView: 'file status/ file view',
    fsExpand: 'file status/ expansion state',
    stgView: 'file status/ staged/ file view',
    stgExpand: 'file status/ staged/ expansion state',
    ustView: 'file status/ unstaged/ file view',
    ustExpand: 'file status/ unstaged/ expansion state'
  }

  return (
    <fieldset className="prefs-group">
      <legend className="prefs-legend">Hierarchical Preferences</legend>
      <fieldset className="prefs-subgroup">
        <legend className="prefs-legend">File Status</legend>
        <div className="prefs-row">
          <PrefSelect
            label={<LabelWithInfo text="File View" links={infoLinksFor('file-view', repos)} />}
            options={[["tree","Tree"],["list","List"]]}
            value={settings[KV.fsView] || ''}
            onChange={(v) => save(KV.fsView, v)}
            saving={savingKey === KV.fsView}
          />
          <PrefSelect
            label={<LabelWithInfo text="Expansion State" links={infoLinksFor('expansion-state', repos)} />}
            options={[["expanded","Expanded"],["collapsed","Collapsed"]]}
            value={settings[KV.fsExpand] || ''}
            onChange={(v) => save(KV.fsExpand, v)}
            saving={savingKey === KV.fsExpand}
          />
        </div>
        <div className="prefs-children">
          <fieldset className="prefs-subgroup">
            <legend className="prefs-legend">Staged</legend>
            <div className="prefs-row">
              <PrefSelect
                label={<LabelWithInfo text="File View" links={infoLinksFor('staged-file-view', repos)} />}
                options={[["tree","Tree"],["list","List"]]}
                value={settings[KV.stgView] || ''}
                onChange={(v) => save(KV.stgView, v)}
                saving={savingKey === KV.stgView}
              />
              <PrefSelect
                label={<LabelWithInfo text="Expansion State" links={infoLinksFor('staged-expansion-state', repos)} />}
                options={[["expanded","Expanded"],["collapsed","Collapsed"]]}
                value={settings[KV.stgExpand] || ''}
                onChange={(v) => save(KV.stgExpand, v)}
                saving={savingKey === KV.stgExpand}
              />
            </div>
          </fieldset>
          <fieldset className="prefs-subgroup">
            <legend className="prefs-legend">Unstaged</legend>
            <div className="prefs-row">
              <PrefSelect
                label={<LabelWithInfo text="File View" links={infoLinksFor('unstaged-file-view', repos)} />}
                options={[["tree","Tree"],["list","List"]]}
                value={settings[KV.ustView] || ''}
                onChange={(v) => save(KV.ustView, v)}
                saving={savingKey === KV.ustView}
              />
              <PrefSelect
                label={<LabelWithInfo text="Expansion State" links={infoLinksFor('unstaged-expansion-state', repos)} />}
                options={[["expanded","Expanded"],["collapsed","Collapsed"]]}
                value={settings[KV.ustExpand] || ''}
                onChange={(v) => save(KV.ustExpand, v)}
                saving={savingKey === KV.ustExpand}
              />
            </div>
          </fieldset>
        </div>
      </fieldset>
    </fieldset>
  )
}

function PrefSelect({ label, options, value, onChange, saving }) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span className="tree__label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={!!saving} style={{ padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6, width: 'fit-content' }}>
        <option value="">(inherit)</option>
        {options.map(([v, t]) => (
          <option key={v} value={v}>{t}</option>
        ))}
      </select>
    </label>
  )
}

function LabelWithInfo({ text, links }) {
  return (
    <>
      <span>{text}</span>
      <span className="info-icon" aria-label={`Where is ${text} used?`}>
        i
        <span className="info-popover">
          <strong style={{ display: 'block', marginBottom: 4 }}>Used on</strong>
          <ul style={{ listStyle: 'disc', paddingInlineStart: 16, margin: 0 }}>
            {links.map((l) => (
              <li key={l.href} style={{ margin: '2px 0' }}>
                <a href={l.href} className="info-link">{l.label}</a>
              </li>
            ))}
          </ul>
        </span>
      </span>
    </>
  )
}

function infoLinksFor(kind, repos) {
  const links = []
  // Repositories index for navigation
  links.push({ href: '/repositories', label: 'Repositories' })
  // Example links into sections for first few repos (up to 3)
  const sample = repos.slice(0, 3)
  for (const r of sample) {
    links.push({ href: `/repositories/${encodeURIComponent(r.name)}/file-status`, label: `${r.name} • File Status` })
    if (kind.includes('file-view') || kind.includes('expansion-state')) {
      links.push({ href: `/repositories/${encodeURIComponent(r.name)}/history`, label: `${r.name} • History (Files panel)` })
    }
  }
  return links
}
