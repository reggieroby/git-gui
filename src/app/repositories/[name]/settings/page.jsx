import { notFound } from 'next/navigation'
import { getLocalRepository, listRepositoryRemotes } from '@/lib/repos'
import { RepoConfigEditor } from '@/components/GitConfigEditors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function RepoSettingsPage({ params }) {
  const name = decodeURIComponent(params.name)
  const repo = await getLocalRepository(name)
  if (!repo) return notFound()
  const { remotes } = await listRepositoryRemotes(repo)
  const monospaceStack = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'

  return (
    <div className="repo-shell repo-shell--full">
      <section className="repo-shell__content">
        <main style={{ display: 'grid', gap: '1rem' }}>
          <h2 style={{ marginTop: '1rem' }}>Settings</h2>
          <div>
            <RepoConfigEditor repoName={repo.name} />
          </div>
          <div>
            <h3 style={{ marginBottom: 8 }}>Remotes</h3>
            {remotes.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No remotes configured.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {remotes.map((remote) => (
                  <div key={remote.name} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem', display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>{remote.name}</span>
                      {remote.url ? (
                        <code style={{ fontSize: '0.8rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{remote.url}</code>
                      ) : (
                        <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>local repository</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.9rem' }}>
                      <strong style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569' }}>Branches</strong>
                      {remote.branches.length ? (
                        <ul style={{ margin: '6px 0 0 0', paddingLeft: '1rem' }}>
                          {remote.branches.map((branch) => (
                            <li key={branch} style={{ fontFamily: monospaceStack, fontSize: '0.85rem' }}>
                              {branch}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div style={{ marginTop: 6, opacity: 0.7 }}>No branches.</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </section>
    </div>
  )
}
