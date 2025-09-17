import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'

const DEFAULT_ROOT = '/srv/repositories'

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

export async function listLocalRepositories(rootDir = DEFAULT_ROOT) {
  try {
    const entries = await readdir(rootDir, { withFileTypes: true })
    const repos = await Promise.all(
      entries
        .filter((e) => e.isDirectory())
        .map(async (e) => {
          const path = join(rootDir, e.name)
          const branch = await readBranch(path)
          return { name: e.name, path, branch }
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
  return { name, path: repoPath, branch }
}
