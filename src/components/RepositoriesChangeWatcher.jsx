"use client"

import { useEffect, useRef } from 'react'

export default function RepositoriesChangeWatcher({ initialToken, pollMs = 5000 }) {
  const lastTokenRef = useRef(initialToken ?? null)

  useEffect(() => {
    lastTokenRef.current = initialToken ?? null
  }, [initialToken])

  useEffect(() => {
    let active = true
    let timer = null

    async function poll() {
      try {
        const response = await fetch('/api/repositories/change-token', { cache: 'no-store' })
        if (!response.ok) return
        const data = await response.json().catch(() => ({}))
        const token = typeof data.token === 'number' ? data.token : null
        if (token == null) return
        if (lastTokenRef.current != null && token > lastTokenRef.current) {
          window.location.reload()
          return
        }
        lastTokenRef.current = token
      } catch {
        // Swallow network errors; we'll try again on the next tick
      }
    }

    function schedule() {
      if (!active) return
      timer = setTimeout(async () => {
        await poll()
        schedule()
      }, pollMs)
    }

    schedule()

    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [pollMs])

  return null
}
