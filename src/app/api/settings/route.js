import { NextResponse } from 'next/server'
import { getAllSettings, getSetting, setSetting } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  if (key) {
    const value = await getSetting(key)
    return NextResponse.json({ key, value })
  }
  return NextResponse.json({ settings: await getAllSettings() })
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    if (!body || typeof body.key !== 'string') {
      return NextResponse.json({ error: 'Missing key' }, { status: 400 })
    }
    const key = body.key
    const value = body.value
    await setSetting(key, value)
    return NextResponse.json({ ok: true, key, value })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 })
  }
}
