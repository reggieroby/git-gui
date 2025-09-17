import { NextResponse } from 'next/server'
import { getLocalRepository } from '@/lib/repos'
import { execFile as _execFile } from 'child_process'
import { promisify } from 'util'
import { stat } from 'fs/promises'

const execFile = promisify(_execFile)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type StatusResult = {
  staged: string[]
  unstaged: string[]
}

export async function GET(
  _req: Request,
  { params }: { params: { name: string } }
) {
  try {
    const name = decodeURIComponent(params.name)
    const repo = await getLocalRepository(name)
    if (!repo) return NextResponse.json({ error: 'Repository not found' }, { status: 404 })

    // If this is not a Git repository, return empty status gracefully
    const isGit = await isGitRepository(repo.path)
    if (!isGit) {
      return NextResponse.json({ staged: [], unstaged: [], notGit: true } as StatusResult & { notGit: boolean })
    }

    const gitBin = process.env.GIT_BIN || 'git'
    const { stdout } = await execFile(gitBin, [
      '-C',
      repo.path,
      'status',
      '--porcelain=v1',
      '-z',
      '--untracked-files=all'
    ])
    const { staged, unstaged } = parsePorcelainZ(stdout as unknown as Buffer)
    return NextResponse.json({ staged, unstaged } as StatusResult)
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return NextResponse.json({ error: 'Git binary not found. Install git or set GIT_BIN to the git executable path.' }, { status: 500 })
    }
    const message = error?.stderr?.toString?.() || error?.message || 'Unknown error'
    // If git indicates not a repository, degrade to empty status
    if (typeof message === 'string' && message.toLowerCase().includes('not a git repository')) {
      return NextResponse.json({ staged: [], unstaged: [], notGit: true })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function isGitRepository(repoPath: string): Promise<boolean> {
  try {
    // Bare repo has HEAD at root; non-bare has .git directory
    const head = await stat(`${repoPath}/HEAD`).catch(() => null)
    if (head && head.isFile()) return true
    const gitDir = await stat(`${repoPath}/.git`).catch(() => null)
    if (gitDir && gitDir.isDirectory()) return true
    return false
  } catch {
    return false
  }
}

function parsePorcelainZ(buf: Buffer | string): StatusResult {
  const s = Buffer.isBuffer(buf) ? buf.toString('utf8') : buf
  const parts = s.split('\u0000')
  const staged = new Set<string>()
  const unstaged = new Set<string>()

  let i = 0
  while (i < parts.length) {
    const entry = parts[i]
    i++
    if (!entry) continue
    // Expect format: XY<space>path (for R/C there is an extra NUL entry with new path)
    const code = entry.slice(0, 2)
    const X = code[0]
    const Y = code[1]
    let path = entry.slice(3)
    // Normalize potential directory entries like "?? dir/" to file paths via -uall,
    // but in case any trailing slash remains, strip it so the UI treats it as a folder node root.
    if (path.endsWith('/')) path = path.replace(/\/$/, '')
    if ((X === 'R' || X === 'C') && i < parts.length) {
      // For rename/copy, next token is the new path
      const newPath = parts[i]
      i++
      if (newPath) path = newPath
    }
    if (X && X !== ' ' && X !== '?') {
      staged.add(path)
    }
    if (code === '??' || (Y && Y !== ' ')) {
      unstaged.add(path)
    }
  }

  return {
    staged: Array.from(staged).sort(),
    unstaged: Array.from(unstaged).sort()
  }
}
