import { redirect, notFound } from 'next/navigation'
import { getLocalRepository } from '@/lib/repos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function RepositoryPage({ params }) {
  const name = decodeURIComponent(params.name)
  const repo = await getLocalRepository(name)
  if (!repo) return notFound()
  // Route-based sections: redirect base to history
  redirect(`/repositories/${encodeURIComponent(name)}/history`)
}
