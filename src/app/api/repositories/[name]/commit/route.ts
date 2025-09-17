import { NextResponse } from 'next/server'
import { getLocalRepository } from '@/lib/repos'
import { execFile as _execFile } from 'child_process'
import { promisify } from 'util'
import { stat } from 'fs/promises'

const execFile = promisify(_execFile)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = {
  message: string
}

export async function POST(req: Request, { params }: { params: { name: string } }) {
  try {
    const name = decodeURIComponent(params.name)
    const repo = await getLocalRepository(name)
    if (!repo) return NextResponse.json({ error: 'Repository not found' }, { status: 404 })

    const isGit = await isGitRepository(repo.path)
    if (!isGit) return NextResponse.json({ error: 'Not a Git repository' }, { status: 400 })

    const body = (await req.json().catch(() => ({}))) as Partial<Body>
    const message = (body.message || '').toString()
    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Commit message is required' }, { status: 400 })
    }

    const gitBin = process.env.GIT_BIN || 'git'
    const { stdout } = await execFile(gitBin, ['-C', repo.path, 'commit', '-m', message])
    return NextResponse.json({ ok: true, output: stdout?.toString?.() || '' })
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return NextResponse.json({ error: 'Git binary not found. Install git or set GIT_BIN.' }, { status: 500 })
    }
    const message = error?.stderr?.toString?.() || error?.message || 'Unknown error'
    if (typeof message === 'string' && message.toLowerCase().includes('nothing to commit')) {
      return NextResponse.json({ error: 'Nothing to commit' }, { status: 400 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
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

