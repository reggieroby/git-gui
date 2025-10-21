import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'
import { execFile as _execFile } from 'child_process'

export const DEFAULT_REPOSITORIES_ROOT = '/srv/repositories'
const DEFAULT_ROOT = DEFAULT_REPOSITORIES_ROOT
const execFile = promisify(_execFile)

async function readBranch(repoPath) {
  // Try bare repo HEAD first, then non-bare .git/HEAD
  const headCandidates = [
    join(repoPath, 'HEAD'),
    join(repoPath, '.git/HEAD')
  ]
  for (const headPath of headCandidates) {
    try {
      const raw = (await readFile(headPath, 'utf8')).trim()
      if (raw.startsWith('ref:')) {
        const ref = raw.slice(4).trim() // e.g. refs/heads/main
        const parts = ref.split('/')
        return parts[parts.length - 1] || null
      }
      // Detached HEAD; raw should be a full SHA
      const sha = raw.match(/^[0-9a-fA-F]{40}$/) ? raw.slice(0, 7) : null
      return sha ? `detached@${sha}` : null
    } catch (_) {
      // Try next candidate
    }
  }
  return null
}

async function hasLocalOnlyCommits(repoPath) {
  if (!(await isGitRepository(repoPath))) return false
  const gitBin = process.env.GIT_BIN || 'git'
  let branches = []
  try {
    const { stdout } = await execFile(gitBin, ['-C', repoPath, 'for-each-ref', 'refs/heads/', '--format=%(refname:strip=2)'])
    branches = stdout
      .toString()
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  } catch {
    return false
  }
  for (const branch of branches) {
    try {
      const { stdout } = await execFile(gitBin, ['-C', repoPath, 'rev-list', '--count', branch, '--not', '--remotes'])
      const count = parseInt(stdout.toString().trim() || '0', 10)
      if (Number.isFinite(count) && count > 0) return true
    } catch {
      // Ignore per-branch errors and keep checking others
    }
  }
  return false
}

export async function listLocalRepositories(rootDir = DEFAULT_ROOT) {
  try {
    const entries = await readdir(rootDir, { withFileTypes: true })
    const repos = await Promise.all(
      entries
        .filter((e) => e.isDirectory())
        .map(async (e) => {
          const path = join(rootDir, e.name)
          const branch = await readBranch(path)
          const hasUnpushedCommits = await hasLocalOnlyCommits(path)
          return { name: e.name, path, branch, hasUnpushedCommits }
        })
    )
    return repos.sort((a, b) => a.name.localeCompare(b.name))
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
      // Root not found or not a directory; treat as no repositories
      return []
    }
    throw err
  }
}

export async function getLocalRepository(name, rootDir = DEFAULT_ROOT) {
  const repoPath = join(rootDir, name)
  try {
    const s = await stat(repoPath)
    if (!s.isDirectory()) return null
  } catch (err) {
    if (err && err.code === 'ENOENT') return null
    throw err
  }
  const branch = await readBranch(repoPath)
  const hasUnpushedCommits = await hasLocalOnlyCommits(repoPath)
  return { name, path: repoPath, branch, hasUnpushedCommits }
}

async function isGitRepository(repoPath) {
  try {
    const head = await stat(join(repoPath, 'HEAD')).catch(() => null)
    if (head && head.isFile()) return true
    const gitDir = await stat(join(repoPath, '.git')).catch(() => null)
    if (gitDir && gitDir.isDirectory()) return true
    return false
  } catch {
    return false
  }
}

export async function repositoriesChangeToken(rootDir = DEFAULT_ROOT) {
  try {
    const rootStat = await stat(rootDir)
    let marker = Math.max(rootStat.mtimeMs || 0, rootStat.ctimeMs || 0)
    const entries = await readdir(rootDir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      const fullPath = join(rootDir, entry.name)
      try {
        const info = await stat(fullPath)
        marker = Math.max(marker, info.mtimeMs || 0, info.ctimeMs || 0)
      } catch {
        // Ignore entries that disappear during traversal
      }
    }
    return marker
  } catch {
    // If the root does not exist yet, return current time to avoid staleness
    return Date.now()
  }
}

export async function listRepositoryRemotes(repoOrName, rootDir = DEFAULT_ROOT) {
  const target = typeof repoOrName === 'string'
    ? await getLocalRepository(repoOrName, rootDir)
    : repoOrName

  if (!target) return { repo: null, remotes: [] }
  if (!(await isGitRepository(target.path))) return { repo: target, remotes: [] }

  const gitBin = process.env.GIT_BIN || 'git'
  const remoteMap = new Map()

  try {
    const { stdout } = await execFile(gitBin, ['-C', target.path, 'remote', '-v'])
    stdout.toString().split('\n').forEach((line) => {
      const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/)
      if (!match) return
      const [, name, url, kind] = match
      if (kind === 'fetch' && !remoteMap.has(name)) remoteMap.set(name, { name, url, branches: [] })
      if (!remoteMap.has(name)) remoteMap.set(name, { name, url, branches: [] })
    })
  } catch {
    // ignore; remote list may be empty
  }

  const remotes = []
  for (const [name, info] of remoteMap.entries()) {
    try {
      const { stdout } = await execFile(gitBin, ['-C', target.path, 'for-each-ref', `refs/remotes/${name}/`, '--format=%(refname:strip=3)'])
      const branches = stdout
        .toString()
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((b) => b !== 'HEAD')
        .sort()
      remotes.push({ ...info, branches, branchStatuses: [] })
    } catch {
      remotes.push({ ...info, branches: [], branchStatuses: [] })
    }
  }

  let localBranches = []
  try {
    const { stdout } = await execFile(gitBin, ['-C', target.path, 'for-each-ref', 'refs/heads/', '--format=%(refname:strip=2)'])
    localBranches = stdout
      .toString()
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .sort()
  } catch {
    localBranches = []
  }

  const localSet = new Set(localBranches)

  for (const remote of remotes) {
    if (!Array.isArray(remote.branches) || remote.branches.length === 0 || localSet.size === 0) {
      remote.branchStatuses = []
      continue
    }
    const branchStatuses = []
    for (const branch of remote.branches) {
      if (!localSet.has(branch)) continue
      try {
        const { stdout: mergeBaseOut } = await execFile(gitBin, ['-C', target.path, 'merge-base', `refs/heads/${branch}`, `refs/remotes/${remote.name}/${branch}`])
        const base = mergeBaseOut.toString().trim()
        if (!base) continue
        const [aheadRes, behindRes] = await Promise.all([
          execFile(gitBin, ['-C', target.path, 'rev-list', '--count', `${base}..refs/heads/${branch}`]),
          execFile(gitBin, ['-C', target.path, 'rev-list', '--count', `${base}..refs/remotes/${remote.name}/${branch}`])
        ])
        const ahead = parseInt(aheadRes.stdout.toString().trim() || '0', 10) || 0
        const behind = parseInt(behindRes.stdout.toString().trim() || '0', 10) || 0
        branchStatuses.push({ remote: remote.name, branch, ahead, behind })
      } catch {
        // Ignore errors (e.g., missing merge base)
      }
    }
    remote.branchStatuses = branchStatuses
  }

  remotes.sort((a, b) => a.name.localeCompare(b.name))
  remotes.unshift({ name: 'local', url: null, branches: localBranches, branchStatuses: [] })

  return { repo: target, remotes }
}
