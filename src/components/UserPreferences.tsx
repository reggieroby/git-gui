"use client"
import { useEffect, useState } from 'react'

const FILE_STATUS_PREF_KEY = 'prefs:fileStatusDefaultView'

export default function UserPreferences() {
  const [fileStatusDefaultView, setFileStatusDefaultView] = useState<'list' | 'tree'>(() => {
    if (typeof window !== 'undefined') {
      const v = window.localStorage.getItem(FILE_STATUS_PREF_KEY)
      if (v === 'list' || v === 'tree') return v
    }
    return 'tree'
  })

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(FILE_STATUS_PREF_KEY, fileStatusDefaultView)
    } catch {}
  }, [fileStatusDefaultView])

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 640 }}>
      <h2 style={{ margin: 0 }}>User Preferences</h2>
      <label style={{ display: 'grid', gap: 4 }}>
        <span className="tree__label">Default File Status View</span>
        <select
          value={fileStatusDefaultView}
          onChange={(e) => setFileStatusDefaultView(e.target.value as 'list' | 'tree')}
          style={{ padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6, width: 'fit-content' }}
        >
          <option value="tree">Tree</option>
          <option value="list">List</option>
        </select>
      </label>
    </div>
  )
}

export { FILE_STATUS_PREF_KEY }

