import { notFound } from 'next/navigation'
import { getLocalRepository } from '@/lib/repos'
import RepoView from '@/components/RepoView'
import type { SectionId } from '@/components/RepoSidebar'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const valid: SectionId[] = ['file-status', 'history', 'branches', 'tags', 'stashes']

export default async function RepoSectionPage({ params }: { params: { name: string; section: string } }) {
  const name = decodeURIComponent(params.name)
  const section = decodeURIComponent(params.section) as SectionId
  if (!valid.includes(section)) return notFound()

  const repo = await getLocalRepository(name)
  if (!repo) return notFound()

  return <RepoView repo={repo} selectedFromRoute={section} />
}

