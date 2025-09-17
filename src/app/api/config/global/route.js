import { NextResponse } from 'next/server'
import { execFile as _execFile } from 'child_process'
import { promisify } from 'util'
import { getSetting, setSetting } from '@/lib/db'

const execFile = promisify(_execFile)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const gitBin = process.env.GIT_BIN || 'git'
    // Prefer DB-backed settings store
    const email = (await getSetting('git/global/user.email')) ?? await readConfig([gitBin, 'config', '--global', '--get', 'user.email'])
    const name = (await getSetting('git/global/user.name')) ?? await readConfig([gitBin, 'config', '--global', '--get', 'user.name'])
    return NextResponse.json({ email, name })
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return NextResponse.json({ error: 'Git binary not found. Install git or set GIT_BIN.' }, { status: 500 })
    }
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const gitBin = process.env.GIT_BIN || 'git'
    const body = (await req.json().catch(() => ({})))
    if (typeof body.email !== 'undefined') {
      await writeConfig(gitBin, 'global', 'user.email', body.email)
      await setSetting('git/global/user.email', body.email ?? '')
    }
    if (typeof body.name !== 'undefined') {
      await writeConfig(gitBin, 'global', 'user.name', body.name)
      await setSetting('git/global/user.name', body.name ?? '')
    }
    return GET()
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return NextResponse.json({ error: 'Git binary not found. Install git or set GIT_BIN.' }, { status: 500 })
    }
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 })
  }
}

async function readConfig(cmd) {
  try {
    const { stdout } = await execFile(cmd[0], cmd.slice(1))
    const v = stdout.toString().trim()
    return v.length ? v : null
  } catch {
    return null
  }
}

async function writeConfig(gitBin, scope, key, value) {
  if (value == null) return
  const args = ['config', '--global']
  if (value.trim() === '') {
    // Unset if empty string provided
    await execFile(gitBin, [...args, '--unset', key]).catch(() => {})
  } else {
    await execFile(gitBin, [...args, key, value])
  }
}

// removed file-based settings helpers; using sqlite-backed store instead
