import { NextResponse } from 'next/server'
import { getLocalRepository } from '@/lib/repos'
import { execFile as _execFile } from 'child_process'
import { promisify } from 'util'
import { stat } from 'fs/promises'

const execFile = promisify(_execFile)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req, { params }) {
  try {
    const name = decodeURIComponent(params.name)
    const repo = await getLocalRepository(name)
    if (!repo) return NextResponse.json({ error: 'Repository not found' }, { status: 404 })

    const isGit = await isGitRepository(repo.path)
    if (!isGit) return NextResponse.json({ error: 'Not a Git repository' }, { status: 400 })

    const body = (await req.json().catch(() => ({})))
    const action = body.action
    const paths = Array.isArray(body.paths) ? body.paths.filter((p) => typeof p === 'string' && p.length > 0) : []
    if (action !== 'stage' && action !== 'unstage') {
      return NextResponse.json({ error: 'Invalid action. Use "stage" or "unstage".' }, { status: 400 })
    }
    if (paths.length === 0) {
      return NextResponse.json({ error: 'No paths provided' }, { status: 400 })
    }

    const gitBin = process.env.GIT_BIN || 'git'
    const args = ['-C', repo.path]
    if (action === 'stage') {
      // Stage provided files/folders
      args.push('add', '--', ...paths)
    } else {
      // Unstage provided files/folders
      args.push('reset', 'HEAD', '--', ...paths)
    }
    const { stdout, stderr } = await execFile(gitBin, args)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return NextResponse.json({ error: 'Git binary not found. Install git or set GIT_BIN.' }, { status: 500 })
    }
    const message = error?.stderr?.toString?.() || error?.message || 'Unknown error'
    if (typeof message === 'string' && message.toLowerCase().includes('not a git repository')) {
      return NextResponse.json({ error: 'Not a Git repository' }, { status: 400 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function isGitRepository(repoPath) {
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
