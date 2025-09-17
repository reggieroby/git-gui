import { redirect, notFound } from 'next/navigation'
import { getLocalRepository } from '@/lib/repos'
import RepoView from '@/components/RepoView'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function RepositoryPage({ params }: { params: { name: string } }) {
  const name = decodeURIComponent(params.name)
  const repo = await getLocalRepository(name)
  if (!repo) return notFound()
  // Route-based sections: redirect base to history
  redirect(`/repositories/${encodeURIComponent(name)}/history`)
}
