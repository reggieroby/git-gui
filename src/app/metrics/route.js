import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Basic in-memory counters
let started = Date.now()
let requestCount = 0

export async function GET() {
  requestCount += 1
  const uptime = (Date.now() - started) / 1000
  const lines = []
  lines.push('# HELP app_uptime_seconds Application uptime in seconds')
  lines.push('# TYPE app_uptime_seconds gauge')
  lines.push(`app_uptime_seconds ${uptime.toFixed(0)}`)
  lines.push('# HELP app_requests_total Total metric scrapes to /metrics')
  lines.push('# TYPE app_requests_total counter')
  lines.push(`app_requests_total ${requestCount}`)
  lines.push('# HELP nodejs_process_pid Process ID of the app')
  lines.push('# TYPE nodejs_process_pid gauge')
  lines.push(`nodejs_process_pid ${process.pid}`)
  const body = lines.join('\n') + '\n'
  const res = new NextResponse(body, { status: 200, headers: { 'Content-Type': 'text/plain; version=0.0.4', 'Cache-Control': 'no-store' } })
  return res
}

