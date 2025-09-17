import { NextResponse } from 'next/server'
import { execFile as _execFile } from 'child_process'
import { promisify } from 'util'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'

const execFile = promisify(_execFile)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Config = { email: string | null; name: string | null }

export async function GET() {
  try {
    const gitBin = process.env.GIT_BIN || 'git'
    // Prefer settings store
    const store = await readSettings()
    const email = (store['git/ global/ user.email'] as string | undefined) ?? await readConfig([gitBin, 'config', '--global', '--get', 'user.email'])
    const name = (store['git/ global/ user.name'] as string | undefined) ?? await readConfig([gitBin, 'config', '--global', '--get', 'user.name'])
    return NextResponse.json({ email, name } satisfies Config)
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return NextResponse.json({ error: 'Git binary not found. Install git or set GIT_BIN.' }, { status: 500 })
    }
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const gitBin = process.env.GIT_BIN || 'git'
    const body = (await req.json().catch(() => ({}))) as Partial<Config>
    if (typeof body.email !== 'undefined') {
      await writeConfig(gitBin, 'global', 'user.email', body.email)
      await writeSetting('git/ global/ user.email', body.email ?? '')
    }
    if (typeof body.name !== 'undefined') {
      await writeConfig(gitBin, 'global', 'user.name', body.name)
      await writeSetting('git/ global/ user.name', body.name ?? '')
    }
    return GET()
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return NextResponse.json({ error: 'Git binary not found. Install git or set GIT_BIN.' }, { status: 500 })
    }
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 })
  }
}

async function readConfig(cmd: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFile(cmd[0], cmd.slice(1))
    const v = stdout.toString().trim()
    return v.length ? v : null
  } catch {
    return null
  }
}

async function writeConfig(gitBin: string, scope: 'global', key: string, value: string | null | undefined) {
  if (value == null) return
  const args: string[] = ['config', '--global']
  if (value.trim() === '') {
    // Unset if empty string provided
    await execFile(gitBin, [...args, '--unset', key]).catch(() => {})
  } else {
    await execFile(gitBin, [...args, key, value])
  }
}

// Settings store helpers
const DEFAULT_STORE = join(process.cwd(), '.data', 'settings.json')
async function ensureDir(p: string) { try { await mkdir(dirname(p), { recursive: true }) } catch {} }
async function readSettings(filePath: string = DEFAULT_STORE): Promise<Record<string, any>> {
  try { const raw = await readFile(filePath, 'utf8'); return JSON.parse(raw) || {} } catch { return {} }
}
async function writeSettings(obj: Record<string, any>, filePath: string = DEFAULT_STORE) {
  await ensureDir(filePath); await writeFile(filePath, JSON.stringify(obj, null, 2), 'utf8')
}
async function writeSetting(key: string, value: any) {
  const all = await readSettings(); all[key] = value; await writeSettings(all)
}
