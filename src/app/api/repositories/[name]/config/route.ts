import { NextResponse } from 'next/server'
import { getLocalRepository } from '@/lib/repos'
import { execFile as _execFile } from 'child_process'
import { promisify } from 'util'
import { stat } from 'fs/promises'

const execFile = promisify(_execFile)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Config = { email: string | null; name: string | null }

export async function GET(_req: Request, { params }: { params: { name: string } }) {
  try {
    const name = decodeURIComponent(params.name)
    const repo = await getLocalRepository(name)
    if (!repo) return NextResponse.json({ error: 'Repository not found' }, { status: 404 })
    const isGit = await isGitRepository(repo.path)
    if (!isGit) return NextResponse.json({ email: null, name: null } satisfies Config)

    const gitBin = process.env.GIT_BIN || 'git'
    const email = await readConfig(gitBin, repo.path, 'user.email')
    const userName = await readConfig(gitBin, repo.path, 'user.name')
    return NextResponse.json({ email, name: userName } satisfies Config)
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return NextResponse.json({ error: 'Git binary not found. Install git or set GIT_BIN.' }, { status: 500 })
    }
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: { name: string } }) {
  try {
    const name = decodeURIComponent(params.name)
    const repo = await getLocalRepository(name)
    if (!repo) return NextResponse.json({ error: 'Repository not found' }, { status: 404 })
    const isGit = await isGitRepository(repo.path)
    if (!isGit) return NextResponse.json({ error: 'Not a Git repository' }, { status: 400 })

    const gitBin = process.env.GIT_BIN || 'git'
    const body = (await req.json().catch(() => ({}))) as Partial<Config>
    if (typeof body.email !== 'undefined') {
      await writeConfig(gitBin, repo.path, 'user.email', body.email)
    }
    if (typeof body.name !== 'undefined') {
      await writeConfig(gitBin, repo.path, 'user.name', body.name)
    }
    return GET(req, { params })
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return NextResponse.json({ error: 'Git binary not found. Install git or set GIT_BIN.' }, { status: 500 })
    }
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 })
  }
}

async function readConfig(gitBin: string, repoPath: string, key: string): Promise<string | null> {
  try {
    const { stdout } = await execFile(gitBin, ['-C', repoPath, 'config', '--get', key])
    const v = stdout.toString().trim()
    return v.length ? v : null
  } catch {
    return null
  }
}

async function writeConfig(gitBin: string, repoPath: string, key: string, value: string | null | undefined) {
  if (value == null) return
  if (value.trim() === '') {
    await execFile(gitBin, ['-C', repoPath, 'config', '--unset', key]).catch(() => {})
  } else {
    await execFile(gitBin, ['-C', repoPath, 'config', key, value])
  }
}

async function isGitRepository(repoPath: string): Promise<boolean> {
  try {
    const head = await stat(`${repoPath}/HEAD`).catch(() => null)
    if (head && head.isFile()) return true
    const gitDir = await stat(`${repoPath}/.git`).catch(() => null)
    if (gitDir && gitDir.isDirectory()) return true
    return false
  } catch {
    return false
  }
}

