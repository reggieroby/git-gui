import { notFound } from 'next/navigation'
import { getLocalRepository } from '@/lib/repos'
import RepoView from '@/components/RepoView'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const valid = ['file-status', 'history']

export default async function RepoSectionPage({ params }) {
  const { name: rawName, section: rawSection } = await params
  const name = decodeURIComponent(rawName || '')
  const section = decodeURIComponent(rawSection || '')
  if (!valid.includes(section)) return notFound()

  const repo = await getLocalRepository(name)
  if (!repo) return notFound()

  return <RepoView repo={repo} selectedFromRoute={section} hideSidebar />
}
