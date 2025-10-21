import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const res = NextResponse.json({ status: 'ok' })
  res.headers.set('Cache-Control', 'no-store')
  return res
}

