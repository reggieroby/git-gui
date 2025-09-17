import { NextResponse } from 'next/server'
import { getLocalRepository } from '@/lib/repos'
import { execFile as _execFile } from 'child_process'
import { promisify } from 'util'

const execFile = promisify(_execFile)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req, { params }) {
  try {
    const name = decodeURIComponent(params.name)
    const id = decodeURIComponent(params.id)
    const repo = await getLocalRepository(name)
    if (!repo) return NextResponse.json({ error: 'Repository not found' }, { status: 404 })
    const gitBin = process.env.GIT_BIN || 'git'
    // Show commit details in machine-readable chunks separated by NUL
    const fmt = ['%H','%h','%P','%T','%s','%f','%an','%ae','%aI','%cn','%ce','%cI'].join('%x00')
    const { stdout } = await execFile(gitBin, ['-C', repo.path, 'show', '--quiet', '--no-patch', `--pretty=format:${fmt}`, id])
    const parts = stdout.toString().split('\u0000')
    const [full, short, parentsStr, tree, subject, subjectSlug, an, ae, aI, cn, ce, cI] = parts
    const parents = (parentsStr || '').trim() ? parentsStr.trim().split(' ') : []
    // Get body separately (can be multi-line)
    const { stdout: bodyOut } = await execFile(gitBin, ['-C', repo.path, 'show', '--quiet', '--pretty=format:%b', id])
    const body = bodyOut.toString()
    // Get changed files
    const { stdout: filesOut } = await execFile(gitBin, ['-C', repo.path, 'diff-tree', '--no-commit-id', '--name-only', '-r', id, '-z'])
    const files = filesOut.toString().split('\u0000').filter(Boolean)
    return NextResponse.json({
      id: full,
      short,
      parents,
      tree,
      subject,
      body,
      author: { name: an, email: ae, date: aI },
      committer: { name: cn, email: ce, date: cI },
      files
    })
  } catch (error) {
    if (error?.code === 'ENOENT') return NextResponse.json({ error: 'Git binary not found. Install git or set GIT_BIN.' }, { status: 500 })
    const message = error?.stderr?.toString?.() || error?.message || 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
