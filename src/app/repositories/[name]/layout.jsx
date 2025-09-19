import '@/app/globals.css'
import { getLocalRepository } from '@/lib/repos'

export async function generateMetadata({ params }) {
  try {
    const rawParams = await params
    const rawName = rawParams?.name
    const name = typeof rawName === 'string' ? decodeURIComponent(rawName) : ''
    if (!name) return { title: 'Repository' }
    const repo = await getLocalRepository(name)
    return { title: repo?.name || name }
  } catch {
    return { title: 'Repository' }
  }
}

export default function RepoLayout({ children }) {
  return children
}
