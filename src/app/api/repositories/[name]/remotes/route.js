import { NextResponse } from 'next/server'
import { getLocalRepository } from '@/lib/repos'
import { execFile as _execFile } from 'child_process'
import { promisify } from 'util'
import { stat } from 'fs/promises'

const execFile = promisify(_execFile)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req, context) {
  try {
    const { name } = await context.params
    const repoName = decodeURIComponent(name)
    const repo = await getLocalRepository(repoName)
    if (!repo) return NextResponse.json({ error: 'Repository not found' }, { status: 404 })

    const isGit = await isGitRepository(repo.path)
    if (!isGit) return NextResponse.json({ remotes: [] })

    const gitBin = process.env.GIT_BIN || 'git'

    // List remotes with URLs (prefer fetch URL)
    const { stdout: remStdout } = await execFile(gitBin, ['-C', repo.path, 'remote', '-v'])
    const remoteMap = new Map()
    remStdout.toString().split('\n').forEach((line) => {
      // format: "origin\t<url> (fetch)" or "(push)"
      const m = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/)
      if (!m) return
      const [, rname, url, kind] = m
      if (kind === 'fetch' && !remoteMap.has(rname)) remoteMap.set(rname, { name: rname, url, branches: [] })
      if (!remoteMap.has(rname)) remoteMap.set(rname, { name: rname, url, branches: [] })
    })

    // For each remote, list local remote-tracking branches (no network): refs/remotes/<remote>/*
    const remotes = []
    for (const [rname, info] of remoteMap.entries()) {
      try {
        const { stdout } = await execFile(
          gitBin,
          ['-C', repo.path, 'for-each-ref', `refs/remotes/${rname}/`, '--format=%(refname:strip=3)']
        )
        const branches = stdout
          .toString()
          .split('\n')
          .map(s => s.trim())
          .filter(Boolean)
          .filter(b => b !== 'HEAD')
          .sort()
        remotes.push({ ...info, branches })
      } catch (_) {
        remotes.push({ ...info, branches: [] })
      }
    }

    // Also include local branches as a synthetic "local" remote
    try {
      const { stdout: headsOut } = await execFile(
        gitBin,
        ['-C', repo.path, 'for-each-ref', 'refs/heads/', '--format=%(refname:strip=2)']
      )
      const localBranches = headsOut
        .toString()
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
        .sort()
      remotes.unshift({ name: 'local', url: null, branches: localBranches })
    } catch (_) {
      remotes.unshift({ name: 'local', url: null, branches: [] })
    }

    // Sort non-local after keeping local as first
    const head = remotes.shift()
    remotes.sort((a, b) => a.name.localeCompare(b.name))
    const final = [head, ...remotes]
    return NextResponse.json({ remotes: final })
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return NextResponse.json({ error: 'Git binary not found. Install git or set GIT_BIN.' }, { status: 500 })
    }
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 })
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
