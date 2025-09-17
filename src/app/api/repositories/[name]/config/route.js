import { NextResponse } from 'next/server'
import { getLocalRepository } from '@/lib/repos'
import { execFile as _execFile } from 'child_process'
import { promisify } from 'util'
import { stat } from 'fs/promises'
import { getSetting, setSetting } from '@/lib/db'

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
    if (!isGit) return NextResponse.json({ email: null, name: null })

    const gitBin = process.env.GIT_BIN || 'git'
    const email = (await getSetting(`git/repo/${repoName}/user.email`)) ?? await readConfig(gitBin, repo.path, 'user.email')
    const userName = (await getSetting(`git/repo/${repoName}/user.name`)) ?? await readConfig(gitBin, repo.path, 'user.name')
    return NextResponse.json({ email, name: userName })
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return NextResponse.json({ error: 'Git binary not found. Install git or set GIT_BIN.' }, { status: 500 })
    }
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 })
  }
}

export async function POST(req, context) {
  try {
    const { name } = await context.params
    const repoName = decodeURIComponent(name)
    const repo = await getLocalRepository(repoName)
    if (!repo) return NextResponse.json({ error: 'Repository not found' }, { status: 404 })
    const isGit = await isGitRepository(repo.path)
    if (!isGit) return NextResponse.json({ error: 'Not a Git repository' }, { status: 400 })

    const gitBin = process.env.GIT_BIN || 'git'
    const body = (await req.json().catch(() => ({})))
    if (typeof body.email !== 'undefined') {
      await writeConfig(gitBin, repo.path, 'user.email', body.email)
      await setSetting(`git/repo/${repoName}/user.email`, body.email ?? '')
    }
    if (typeof body.name !== 'undefined') {
      await writeConfig(gitBin, repo.path, 'user.name', body.name)
      await setSetting(`git/repo/${repoName}/user.name`, body.name ?? '')
    }
    return GET(req, { params })
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return NextResponse.json({ error: 'Git binary not found. Install git or set GIT_BIN.' }, { status: 500 })
    }
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 })
  }
}

async function readConfig(gitBin, repoPath, key) {
  try {
    const { stdout } = await execFile(gitBin, ['-C', repoPath, 'config', '--get', key])
    const v = stdout.toString().trim()
    return v.length ? v : null
  } catch {
    return null
  }
}

async function writeConfig(gitBin, repoPath, key, value) {
  if (value == null) return
  if (value.trim() === '') {
    await execFile(gitBin, ['-C', repoPath, 'config', '--unset', key]).catch(() => {})
  } else {
    await execFile(gitBin, ['-C', repoPath, 'config', key, value])
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

// removed file-based settings helpers; using sqlite-backed store instead
