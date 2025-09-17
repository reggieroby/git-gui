import { notFound } from 'next/navigation'
import { getLocalRepository } from '@/lib/repos'
import RepoSidebar, { SectionId } from '@/components/RepoSidebar'
import { RepoConfigEditor } from '@/components/GitConfigEditors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function RepoSettingsPage({ params }: { params: { name: string } }) {
  const name = decodeURIComponent(params.name)
  const repo = await getLocalRepository(name)
  if (!repo) return notFound()

  return (
    <div className="repo-shell">
      <aside className="repo-shell__sidebar">
        <RepoSidebar selected={'settings' as SectionId} basePath={`/repositories/${encodeURIComponent(repo.name)}`} repo={{ name: repo.name, branch: repo.branch, path: repo.path }} />
      </aside>
      <section className="repo-shell__content">
        <main style={{ display: 'grid', gap: '1rem' }}>
          <h2 style={{ marginTop: '1rem' }}>Settings</h2>
          <div>
            <RepoConfigEditor repoName={repo.name} />
          </div>
        </main>
      </section>
    </div>
  )
}
