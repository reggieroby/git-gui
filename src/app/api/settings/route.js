import { NextResponse } from 'next/server'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_STORE = join(process.cwd(), '.data', 'settings.json')

async function ensureDir(p) {
  try {
    await mkdir(dirname(p), { recursive: true })
  } catch {}
}

async function readSettings(filePath = DEFAULT_STORE) {
  try {
    const raw = await readFile(filePath, 'utf8')
    const data = JSON.parse(raw)
    if (data && typeof data === 'object') return data
    return {}
  } catch {
    return {}
  }
}

async function writeSettings(obj, filePath = DEFAULT_STORE) {
  await ensureDir(filePath)
  await writeFile(filePath, JSON.stringify(obj, null, 2), 'utf8')
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  const all = await readSettings()
  if (key) {
    const value = all[key] ?? null
    return NextResponse.json({ key, value })
  }
  return NextResponse.json({ settings: all })
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    if (!body || typeof body.key !== 'string') {
      return NextResponse.json({ error: 'Missing key' }, { status: 400 })
    }
    const key = body.key
    const value = body.value
    const all = await readSettings()
    all[key] = value
    await writeSettings(all)
    return NextResponse.json({ ok: true, key, value })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 })
  }
}
