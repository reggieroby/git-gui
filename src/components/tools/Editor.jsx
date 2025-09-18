"use client"
import React from 'react'

export default function Editor({ title = 'editor tools', children, style }) {
  return (
    <div
      className="editor-tools"
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 12,
        display: 'grid',
        gap: 8,
        background: '#ffffff',
        ...style,
      }}
    >
      <div style={{ fontWeight: 600, color: '#111827', textTransform: 'capitalize' }}>{title}</div>
      <div style={{ display: 'grid', gap: 8 }}>{children}</div>
    </div>
  )
}

