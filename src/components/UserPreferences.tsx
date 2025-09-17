"use client"
import { useEffect, useState } from 'react'

export default function UserPreferences() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 900 }}>
      <h2 style={{ margin: 0 }}>User Preferences</h2>
      <HierarchicalPrefs />
    </div>
  )
}

function HierarchicalPrefs() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/settings', { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (!cancelled && res.ok) setSettings(data.settings || {})
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])

  async function save(key: string, value: string) {
    setSavingKey(key)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) setSettings((prev) => ({ ...prev, [key]: data.value }))
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
            label="File View"
            options={[["tree","Tree"],["list","List"]]}
            value={settings[KV.fsView] || ''}
            onChange={(v) => save(KV.fsView, v)}
            saving={savingKey === KV.fsView}
          />
          <PrefSelect
            label="Expansion State"
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
                label="File View"
                options={[["tree","Tree"],["list","List"]]}
                value={settings[KV.stgView] || ''}
                onChange={(v) => save(KV.stgView, v)}
                saving={savingKey === KV.stgView}
              />
              <PrefSelect
                label="Expansion State"
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
                label="File View"
                options={[["tree","Tree"],["list","List"]]}
                value={settings[KV.ustView] || ''}
                onChange={(v) => save(KV.ustView, v)}
                saving={savingKey === KV.ustView}
              />
              <PrefSelect
                label="Expansion State"
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

function PrefSelect({ label, options, value, onChange, saving }: { label: string; options: [string,string][]; value: string; onChange: (v: string) => void; saving?: boolean }) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span className="tree__label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={!!saving} style={{ padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6, width: 'fit-content' }}>
        <option value="">(inherit)</option>
        {options.map(([v, t]) => (
          <option key={v} value={v}>{t}</option>
        ))}
      </select>
    </label>
  )
}
