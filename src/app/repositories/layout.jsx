import { listLocalRepositories, getLocalRepository, repositoriesChangeToken } from '@/lib/repos'
import RepositoriesSidebar from '@/components/RepositoriesSidebar'
import RepositoriesChangeWatcher from '@/components/RepositoriesChangeWatcher'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function RepositoriesLayout({ children, params }) {
  const repos = await listLocalRepositories()
  const changeToken = await repositoriesChangeToken()
  console.log({ repos })
  const rawName = params?.name
  const selectedName = typeof rawName === 'string' ? decodeURIComponent(rawName) : null
  let selectedRepo = null
  if (selectedName) {
    selectedRepo = await getLocalRepository(selectedName)
    if (!selectedRepo) {
      selectedRepo = repos.find((r) => r.name === selectedName) || null
    }
  }

  return (
    <div className="repositories-shell">
      <RepositoriesChangeWatcher initialToken={changeToken} />
      <aside className="repositories-shell__sidebar">a
        <RepositoriesSidebar
          repos={repos}
          selectedName={selectedRepo?.name || null}
          selectedRepo={selectedRepo}
        />
      </aside>
      <main className="repositories-shell__content">
        {children}
      </main>
    </div>
  )
}
