import { NextResponse } from 'next/server'
import { getLocalRepository, listLocalRepositories } from '@/lib/repos'
import { execFile as _execFile } from 'child_process'
import { promisify } from 'util'
import { stat } from 'fs/promises'

const execFile = promisify(_execFile)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    const op = body.operationName || inferOperation(body.query)
    const vars = body.variables || {}
    switch (op) {
      case 'RepoHistory':
      case 'history':
        return NextResponse.json({ data: { history: await history(vars) } })
      case 'RepoRemotes':
      case 'remotes':
        return NextResponse.json({ data: { remotes: await remotes(vars) } })
      case 'Commit':
      case 'commit':
        return NextResponse.json({ data: { commit: await commit(vars) } })
      case 'Settings':
      case 'settings':
        return NextResponse.json({ data: { settings: await settings() } })
      case 'SetSetting':
      case 'setSetting':
        return NextResponse.json({ data: { setSetting: await setSetting(vars) } })
      case 'Diff':
      case 'diff':
        return NextResponse.json({ data: { diff: await diff(vars) } })
      case 'Repositories':
      case 'repositories':
        return NextResponse.json({ data: { repositories: await repositories() } })
      case 'GlobalConfig':
      case 'globalConfig':
        return NextResponse.json({ data: { globalConfig: await globalConfig() } })
      case 'SetGlobalConfig':
      case 'setGlobalConfig':
        return NextResponse.json({ data: { setGlobalConfig: await setGlobalConfig(vars) } })
      case 'RepoConfig':
      case 'repoConfig':
        return NextResponse.json({ data: { repoConfig: await repoConfig(vars) } })
      case 'SetRepoConfig':
      case 'setRepoConfig':
        return NextResponse.json({ data: { setRepoConfig: await setRepoConfig(vars) } })
      case 'CreateBranch':
      case 'createBranch':
        return NextResponse.json({ data: { createBranch: await createBranch(vars) } })
      case 'Status':
      case 'status':
        return NextResponse.json({ data: { status: await status(vars) } })
      case 'Stage':
      case 'stage':
        return NextResponse.json({ data: { stage: await stage(vars) } })
      case 'CommitCreate':
      case 'commitCreate':
        return NextResponse.json({ data: { commitCreate: await commitCreate(vars) } })
      default:
        return NextResponse.json({ errors: [{ message: `Unknown operation: ${op || 'undefined'}` }] }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ errors: [{ message: error?.message || 'Unknown error' }] }, { status: 500 })
  }
}

function inferOperation(q) {
  if (typeof q !== 'string') return null
  if (/\bhistory\s*\(/.test(q)) return 'history'
  if (/\bremotes\s*\(/.test(q)) return 'remotes'
  if (/\bcommit\s*\(/.test(q)) return 'commit'
  if (/\bcreateBranch\s*\(/.test(q)) return 'createBranch'
  if (/\bstatus\s*\(/.test(q)) return 'status'
  if (/\bstage\s*\(/.test(q)) return 'stage'
  if (/\bcommitCreate\s*\(/.test(q)) return 'commitCreate'
  if (/\bsettings\s*\(/.test(q)) return 'settings'
  if (/\bsetSetting\s*\(/.test(q)) return 'setSetting'
  if (/\bdiff\s*\(/.test(q)) return 'diff'
  if (/\brepositories\s*\(/.test(q)) return 'repositories'
  if (/\bglobalConfig\s*\(/.test(q)) return 'globalConfig'
  if (/\bsetGlobalConfig\s*\(/.test(q)) return 'setGlobalConfig'
  if (/\brepoConfig\s*\(/.test(q)) return 'repoConfig'
  if (/\bsetRepoConfig\s*\(/.test(q)) return 'setRepoConfig'
  return null
}

async function isGitRepository(repoPath) {
  try {
    const head = await stat(`${repoPath}/HEAD`).catch(() => null)
    if (head && head.isFile()) return true
    const gitDir = await stat(`${repoPath}/.git`).catch(() => null)
    if (gitDir && gitDir.isDirectory()) return true
    return false
  } catch { return false }
}

async function history({ name, limit = 200 }) {
  const repoName = decodeURIComponent(name)
  const repo = await getLocalRepository(repoName)
  if (!repo) throw new Error('Repository not found')
  if (!(await isGitRepository(repo.path))) return { commits: [], maxLanes: 0, notGit: true }
  const gitBin = process.env.GIT_BIN || 'git'
  const { stdout } = await execFile(gitBin, [
    '-C', repo.path,
    'log', '--topo-order', '--date=iso-strict', '--pretty=format:%H%x00%h%x00%P%x00%s%x00%an%x00%ae%x00%aI', '-z', '-n', String(limit)
  ])
  const commits = parseLog(stdout)
  const { rows, maxLanes } = assignLanes(commits)
  const labelsById = new Map()
  // remote heads
  try {
    const { stdout: refsOut } = await execFile(gitBin, ['-C', repo.path, 'for-each-ref', 'refs/remotes/', '--format=%(refname:short)%00%(objectname)', '-z'])
    const parts = refsOut.toString('utf8').split('\u0000').filter(Boolean)
    for (let i = 0; i + 1 < parts.length; i += 2) {
      const ref = (parts[i] || '').trim()
      const obj = (parts[i + 1] || '').trim()
      if (!ref || !obj) continue
      if (/\/HEAD$/.test(ref)) continue
      const arr = labelsById.get(obj) || []
      arr.push(ref)
      labelsById.set(obj, arr)
    }
  } catch {}
  // local heads
  try {
    const { stdout: headsOut } = await execFile(gitBin, ['-C', repo.path, 'for-each-ref', 'refs/heads/', '--format=%(refname:short)%00%(objectname)', '-z'])
    const parts = headsOut.toString('utf8').split('\u0000').filter(Boolean)
    for (let i = 0; i + 1 < parts.length; i += 2) {
      const br = (parts[i] || '').trim()
      const obj = (parts[i + 1] || '').trim()
      if (!br || !obj) continue
      const arr = labelsById.get(obj) || []
      arr.push(`local/${br}`)
      labelsById.set(obj, arr)
    }
  } catch {}
  // HEAD
  try {
    const { stdout: headCommitOut } = await execFile(gitBin, ['-C', repo.path, 'rev-parse', 'HEAD'])
    const headCommit = headCommitOut.toString().trim()
    if (headCommit) {
      const arr = labelsById.get(headCommit) || []
      arr.push('HEAD')
      labelsById.set(headCommit, arr)
    }
  } catch {}
  return {
    commits: rows.map(r => ({
      id: r.id,
      short: r.short,
      lane: r.lane,
      parents: r.parents || [],
      parentLanes: r.parentLanes || [],
      labels: Array.from(new Set(labelsById.get(r.id) || [])),
      message: r.message,
      authorName: r.authorName,
      authorEmail: r.authorEmail,
      authorDate: r.authorDate
    })),
    maxLanes
  }
}

async function remotes({ name }) {
  const repoName = decodeURIComponent(name)
  const repo = await getLocalRepository(repoName)
  if (!repo) throw new Error('Repository not found')
  if (!(await isGitRepository(repo.path))) return []
  const gitBin = process.env.GIT_BIN || 'git'
  const { stdout: remStdout } = await execFile(gitBin, ['-C', repo.path, 'remote', '-v'])
  const remoteMap = new Map()
  remStdout.toString().split('\n').forEach((line) => {
    const m = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/)
    if (!m) return
    const [, rname, url, kind] = m
    if (kind === 'fetch' && !remoteMap.has(rname)) remoteMap.set(rname, { name: rname, url, branches: [] })
    if (!remoteMap.has(rname)) remoteMap.set(rname, { name: rname, url, branches: [] })
  })
  const remotes = []
  for (const [rname, info] of remoteMap.entries()) {
    try {
      const { stdout } = await execFile(gitBin, ['-C', repo.path, 'for-each-ref', `refs/remotes/${rname}/`, '--format=%(refname:strip=3)'])
      const branches = stdout.toString().split('\n').map(s => s.trim()).filter(Boolean).filter(b => b !== 'HEAD').sort()
      remotes.push({ ...info, branches })
    } catch { remotes.push({ ...info, branches: [] }) }
  }
  // include local
  try {
    const { stdout: headsOut } = await execFile(gitBin, ['-C', repo.path, 'for-each-ref', 'refs/heads/', '--format=%(refname:strip=2)'])
    const localBranches = headsOut.toString().split('\n').map(s => s.trim()).filter(Boolean).sort()
    remotes.unshift({ name: 'local', url: null, branches: localBranches })
  } catch { remotes.unshift({ name: 'local', url: null, branches: [] }) }
  // sort (keep local first)
  const head = remotes.shift()
  remotes.sort((a, b) => a.name.localeCompare(b.name))
  return [head, ...remotes]
}

async function commit({ name, id }) {
  const repoName = decodeURIComponent(name)
  const commitId = decodeURIComponent(id)
  const repo = await getLocalRepository(repoName)
  if (!repo) throw new Error('Repository not found')
  const gitBin = process.env.GIT_BIN || 'git'
  const fmt = ['%H','%h','%P','%T','%s','%f','%an','%ae','%aI','%cn','%ce','%cI'].join('%x00')
  const { stdout } = await execFile(gitBin, ['-C', repo.path, 'show', '--quiet', '--no-patch', `--pretty=format:${fmt}`, commitId])
  const parts = stdout.toString().split('\u0000')
  const [full, short, parentsStr, tree, subject, subjectSlug, an, ae, aI, cn, ce, cI] = parts
  const parents = (parentsStr || '').trim() ? parentsStr.trim().split(' ') : []
  const { stdout: bodyOut } = await execFile(gitBin, ['-C', repo.path, 'show', '--quiet', '--pretty=format:%b', commitId])
  const body = bodyOut.toString()
  const { stdout: filesOut } = await execFile(gitBin, ['-C', repo.path, 'diff-tree', '--no-commit-id', '--name-only', '-r', commitId, '-z'])
  const files = filesOut.toString().split('\u0000').filter(Boolean)
  return {
    id: full,
    short,
    parents,
    tree,
    subject,
    body,
    author: { name: an, email: ae, date: aI },
    committer: { name: cn, email: ce, date: cI },
    files
  }
}

async function createBranch({ name, remote, branch, from = 'HEAD' }) {
  const repoName = decodeURIComponent(name)
  const remoteName = decodeURIComponent(remote)
  const repo = await getLocalRepository(repoName)
  if (!repo) throw new Error('Repository not found')
  const gitBin = process.env.GIT_BIN || 'git'
  if (!branch || /\s/.test(branch)) throw new Error('Invalid branch name')
  await execFile(gitBin, ['-C', repo.path, 'rev-parse', '--verify', from])
  try { await execFile(gitBin, ['-C', repo.path, 'show-ref', '--verify', `refs/heads/${branch}`]) }
  catch { await execFile(gitBin, ['-C', repo.path, 'branch', branch, from]) }
  let pushed = false
  let pushError = null
  if (remoteName !== 'local') {
    try { await execFile(gitBin, ['-C', repo.path, 'push', remoteName, `${branch}:refs/heads/${branch}`]); pushed = true }
    catch (e) { pushError = e?.stderr?.toString?.() || e?.message || 'push failed' }
  }
  return { ok: true, created: true, pushed, pushError }
}

async function status({ name }) {
  const repoName = decodeURIComponent(name)
  const repo = await getLocalRepository(repoName)
  if (!repo) throw new Error('Repository not found')
  if (!(await isGitRepository(repo.path))) return { staged: [], unstaged: [], notGit: true }
  const gitBin = process.env.GIT_BIN || 'git'
  const { stdout } = await execFile(gitBin, ['-C', repo.path, 'status', '--porcelain=v1', '-z', '--untracked-files=all'])
  return parsePorcelainZ(stdout)
}

async function stage({ name, action, paths }) {
  const repoName = decodeURIComponent(name)
  const repo = await getLocalRepository(repoName)
  if (!repo) throw new Error('Repository not found')
  if (!(await isGitRepository(repo.path))) throw new Error('Not a Git repository')
  const list = Array.isArray(paths) ? paths.filter(p => typeof p === 'string' && p.length > 0) : []
  if (action !== 'stage' && action !== 'unstage') throw new Error('Invalid action')
  if (list.length === 0) throw new Error('No paths provided')
  const gitBin = process.env.GIT_BIN || 'git'
  const args = ['-C', repo.path]
  if (action === 'stage') args.push('add', '--', ...list)
  else args.push('reset', 'HEAD', '--', ...list)
  await execFile(gitBin, args)
  return { ok: true }
}

async function commitCreate({ name, message }) {
  const repoName = decodeURIComponent(name)
  const repo = await getLocalRepository(repoName)
  if (!repo) throw new Error('Repository not found')
  if (!(await isGitRepository(repo.path))) throw new Error('Not a Git repository')
  const msg = (message || '').toString()
  if (!msg.trim()) throw new Error('Commit message is required')
  const gitBin = process.env.GIT_BIN || 'git'
  await execFile(gitBin, ['-C', repo.path, 'commit', '-m', msg])
  return { ok: true }
}

function parsePorcelainZ(buf) {
  const s = Buffer.isBuffer(buf) ? buf.toString('utf8') : buf
  const parts = s.split('\u0000')
  const staged = new Set()
  const unstaged = new Set()
  let i = 0
  while (i < parts.length) {
    const entry = parts[i]; i++; if (!entry) continue
    const code = entry.slice(0, 2)
    const X = code[0], Y = code[1]
    let path = entry.slice(3)
    if (path.endsWith('/')) path = path.replace(/\/$/, '')
    if ((X === 'R' || X === 'C') && i < parts.length) { const newPath = parts[i]; i++; if (newPath) path = newPath }
    if (X && X !== ' ' && X !== '?') staged.add(path)
    if (code === '??' || (Y && Y !== ' ')) unstaged.add(path)
  }
  return { staged: Array.from(staged).sort(), unstaged: Array.from(unstaged).sort() }
}

// Settings and Diff
import { getAllSettings, setSetting as _setSetting } from '@/lib/db'
import { getSetting as _getSetting } from '@/lib/db'
async function settings() {
  const all = await getAllSettings()
  return all
}
async function setSetting({ key, value }) {
  if (typeof key !== 'string') throw new Error('Missing key')
  await _setSetting(key, value)
  return { ok: true, key, value }
}
async function diff({ name, path, staged = false }) {
  const repoName = decodeURIComponent(name)
  const repo = await getLocalRepository(repoName)
  if (!repo) throw new Error('Repository not found')
  const gitBin = process.env.GIT_BIN || 'git'
  const args = ['-C', repo.path, 'diff']
  if (staged) args.splice(2, 0, '--staged')
  args.push('--', path)
  const { stdout } = await execFile(gitBin, args)
  return { path, staged: !!staged, text: stdout.toString() }
}

// Repositories list
async function repositories() {
  const list = await listLocalRepositories()
  return list
}

// Config (global and repo)
async function globalConfig() {
  const gitBin = process.env.GIT_BIN || 'git'
  const email = (await _getSetting('git/global/user.email')) ?? await readGlobalConfig([gitBin, 'config', '--global', '--get', 'user.email'])
  const name = (await _getSetting('git/global/user.name')) ?? await readGlobalConfig([gitBin, 'config', '--global', '--get', 'user.name'])
  return { email, name }
}
async function setGlobalConfig({ email, name }) {
  const gitBin = process.env.GIT_BIN || 'git'
  if (typeof email !== 'undefined') {
    await writeGlobalConfig(gitBin, 'user.email', email)
    await _setSetting('git/global/user.email', email ?? '')
  }
  if (typeof name !== 'undefined') {
    await writeGlobalConfig(gitBin, 'user.name', name)
    await _setSetting('git/global/user.name', name ?? '')
  }
  return await globalConfig()
}
async function repoConfig({ name }) {
  const repoName = decodeURIComponent(name)
  const repo = await getLocalRepository(repoName)
  if (!repo) throw new Error('Repository not found')
  const gitBin = process.env.GIT_BIN || 'git'
  const email = (await _getSetting(`git/repo/${repoName}/user.email`)) ?? await readRepoConfig(gitBin, repo.path, 'user.email')
  const userName = (await _getSetting(`git/repo/${repoName}/user.name`)) ?? await readRepoConfig(gitBin, repo.path, 'user.name')
  return { email, name: userName }
}
async function setRepoConfig({ name, email, userName }) {
  const repoName = decodeURIComponent(name)
  const repo = await getLocalRepository(repoName)
  if (!repo) throw new Error('Repository not found')
  const gitBin = process.env.GIT_BIN || 'git'
  if (typeof email !== 'undefined') {
    await writeRepoConfig(gitBin, repo.path, 'user.email', email)
    await _setSetting(`git/repo/${repoName}/user.email`, email ?? '')
  }
  if (typeof userName !== 'undefined') {
    await writeRepoConfig(gitBin, repo.path, 'user.name', userName)
    await _setSetting(`git/repo/${repoName}/user.name`, userName ?? '')
  }
  return await repoConfig({ name: repoName })
}

async function readGlobalConfig(cmd) {
  try { const { stdout } = await execFile(cmd[0], cmd.slice(1)); const v = stdout.toString().trim(); return v.length ? v : null } catch { return null }
}
async function writeGlobalConfig(gitBin, key, value) {
  if (value == null) return
  const args = ['config', '--global']
  if (value.trim() === '') await execFile(gitBin, [...args, '--unset', key]).catch(() => {})
  else await execFile(gitBin, [...args, key, value])
}
async function readRepoConfig(gitBin, repoPath, key) {
  try { const { stdout } = await execFile(gitBin, ['-C', repoPath, 'config', '--get', key]); const v = stdout.toString().trim(); return v.length ? v : null } catch { return null }
}
async function writeRepoConfig(gitBin, repoPath, key, value) {
  if (value == null) return
  if (value.trim() === '') await execFile(gitBin, ['-C', repoPath, 'config', '--unset', key]).catch(() => {})
  else await execFile(gitBin, ['-C', repoPath, 'config', key, value])
}

function parseLog(buf) {
  const s = Buffer.isBuffer(buf) ? buf.toString('utf8') : buf
  const parts = s.split('\u0000').filter(Boolean)
  const commits = []
  for (let i = 0; i + 6 < parts.length; i += 7) {
    const id = parts[i]
    const short = parts[i + 1] || id.slice(0, 7)
    const parentsStr = parts[i + 2] || ''
    const message = parts[i + 3] || ''
    const authorName = parts[i + 4] || ''
    const authorEmail = parts[i + 5] || ''
    const authorDate = parts[i + 6] || ''
    const parents = parentsStr.trim() ? parentsStr.trim().split(' ') : []
    commits.push({ id, short, parents, message, authorName, authorEmail, authorDate })
  }
  return commits
}

function assignLanes(commits) {
  const active = []
  const rows = []
  let maxLanes = 0
  for (const c of commits) {
    let idx = active.indexOf(c.id)
    if (idx === -1) { idx = active.length; active.push(c.id) }
    active.splice(idx, 1)
    let insertAt = idx
    const parentLanes = []
    for (const p of c.parents) {
      const existing = active.indexOf(p)
      if (existing !== -1) parentLanes.push(existing)
      else { parentLanes.push(insertAt); active.splice(insertAt, 0, p); insertAt += 1 }
    }
    rows.push({ id: c.id, short: c.short, parents: c.parents, lane: idx, parentLanes, message: c.message, authorName: c.authorName, authorEmail: c.authorEmail, authorDate: c.authorDate })
    if (active.length > maxLanes) maxLanes = active.length
  }
  if (commits.length > 0) maxLanes = Math.max(maxLanes, 1)
  return { rows, maxLanes }
}
