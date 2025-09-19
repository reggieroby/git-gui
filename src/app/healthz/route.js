import { NextResponse } from 'next/server'
import { getAllSettings, getDb } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const settings = await getAllSettings()
  let migrations = { current: null, executed_at: null, count: 0 }
  try {
    const db = await getDb()
    const countRow = await db.get('SELECT COUNT(1) AS c FROM migrations')
    const latest = await db.get('SELECT name, executed_at FROM migrations ORDER BY executed_at DESC LIMIT 1')
    migrations = {
      current: latest?.name ?? null,
      executed_at: latest?.executed_at ?? null,
      count: countRow?.c ?? 0
    }
  } catch (_) {
    // migrations table may not exist yet; ignore
  }
  const body = {
    status: 'ok',
    uptime_s: Math.floor(process.uptime()),
    pid: process.pid,
    version: process.env.npm_package_version || undefined,
    checks: { livez: 'ok', readyz: 'ok' },
    migrations,
    settings
  }
  const res = NextResponse.json(body)
  res.headers.set('Cache-Control', 'no-store')
  return res
}
