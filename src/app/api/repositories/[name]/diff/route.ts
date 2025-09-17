import { NextResponse } from 'next/server'
import { getLocalRepository } from '@/lib/repos'
import { execFile as _execFile } from 'child_process'
import { promisify } from 'util'

const execFile = promisify(_execFile)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: { name: string } }) {
  try {
    const name = decodeURIComponent(params.name)
    const repo = await getLocalRepository(name)
    if (!repo) return NextResponse.json({ error: 'Repository not found' }, { status: 404 })
    const { searchParams } = new URL(req.url)
    const path = searchParams.get('path')
    const staged = searchParams.get('staged') === 'true'
    if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 400 })
    const gitBin = process.env.GIT_BIN || 'git'
    const args = ['-C', repo.path, 'diff', '--no-color']
    if (staged) args.push('--cached')
    args.push('--', path)
    const { stdout } = await execFile(gitBin, args)
    return NextResponse.json({ path, staged, diff: stdout.toString() })
  } catch (error: any) {
    if (error?.code === 'ENOENT') return NextResponse.json({ error: 'Git binary not found. Install git or set GIT_BIN.' }, { status: 500 })
    const message = error?.stderr?.toString?.() || error?.message || 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

