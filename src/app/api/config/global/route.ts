import { NextResponse } from 'next/server'
import { execFile as _execFile } from 'child_process'
import { promisify } from 'util'

const execFile = promisify(_execFile)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Config = { email: string | null; name: string | null }

export async function GET() {
  try {
    const gitBin = process.env.GIT_BIN || 'git'
    const email = await readConfig([gitBin, 'config', '--global', '--get', 'user.email'])
    const name = await readConfig([gitBin, 'config', '--global', '--get', 'user.name'])
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
    }
    if (typeof body.name !== 'undefined') {
      await writeConfig(gitBin, 'global', 'user.name', body.name)
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

