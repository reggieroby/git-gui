import { NextResponse } from 'next/server'
import { getLocalRepository } from '@/lib/repos'
import { execFile as _execFile } from 'child_process'
import { promisify } from 'util'
import { stat } from 'fs/promises'

const execFile = promisify(_execFile)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req, context) {
  try {
    const { name, remote } = await context.params
    const repoName = decodeURIComponent(name)
    const remoteName = decodeURIComponent(remote)
    const repo = await getLocalRepository(repoName)
    if (!repo) return NextResponse.json({ error: 'Repository not found' }, { status: 404 })

    const isGit = await isGitRepository(repo.path)
    if (!isGit) return NextResponse.json({ error: 'Not a Git repository' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const branch = (body?.branch || '').toString().trim()
    const from = (body?.from || 'HEAD').toString().trim()
    if (!branch) return NextResponse.json({ error: 'Branch name is required' }, { status: 400 })

    const gitBin = process.env.GIT_BIN || 'git'

    // Create local branch ref without switching working tree
    // Validate ref format (basic)
    if (/\s/.test(branch)) return NextResponse.json({ error: 'Invalid branch name' }, { status: 400 })

    // Ensure base exists
    await execFile(gitBin, ['-C', repo.path, 'rev-parse', '--verify', from])

    // Create branch if it does not exist
    try {
      await execFile(gitBin, ['-C', repo.path, 'show-ref', '--verify', `refs/heads/${branch}`])
      // exists
    } catch {
      await execFile(gitBin, ['-C', repo.path, 'branch', branch, from])
    }

    // Try to push to remote to create remote branch (skip for synthetic 'local')
    let pushed = false
    let pushError = null
    if (remoteName !== 'local') {
      try {
        await execFile(gitBin, ['-C', repo.path, 'push', remoteName, `${branch}:refs/heads/${branch}`])
        pushed = true
      } catch (e) {
        pushError = e?.stderr?.toString?.() || e?.message || 'push failed'
      }
    }

    return NextResponse.json({ ok: true, created: true, pushed, pushError: pushed ? null : pushError })
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return NextResponse.json({ error: 'Git binary not found. Install git or set GIT_BIN.' }, { status: 500 })
    }
    const message = error?.stderr?.toString?.() || error?.message || 'Unknown error'
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
