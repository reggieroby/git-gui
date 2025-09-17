import { listLocalRepositories } from '@/lib/repos'
import { GlobalConfigEditor, RepoConfigEditor } from '@/components/GitConfigEditors'
import UserPreferences from '@/components/UserPreferences'
import Link from 'next/link'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const repos = await listLocalRepositories()
  return (
    <main style={{
      minHeight: 'calc(100vh - var(--topnav-h))',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      flexDirection: 'column',
      gap: '1.5rem',
      padding: '2rem',
      maxWidth: 1100,
      margin: '0 auto'
    }}>
      <section style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Git</h2>
          <Link href="/docs" className="topnav__link" title="Open documentation">Documentation</Link>
        </div>
        <div className="settings-children">
          <div>
            <GlobalConfigEditor />
          </div>
          <div>
            <h3 style={{ marginTop: '1rem', marginBottom: 8 }}>Repositories</h3>
            {repos.length === 0 ? (
              <p style={{ opacity: 0.8 }}>No repositories found at <code>/srv/repositories</code>.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '1rem' }}>
                {repos.map((r) => (
                  <li key={r.path} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem 1rem', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div>
                        <code style={{ fontSize: '0.95rem' }}>{r.name}</code>
                        <div style={{ opacity: 0.7, fontSize: '0.85rem', marginTop: 4 }}>{r.path}</div>
                      </div>
                      <span
                        title={r.branch ?? 'unknown'}
                        style={{
                          marginLeft: 12,
                          whiteSpace: 'nowrap',
                          fontSize: '0.8rem',
                          border: '1px solid #e0e7ff',
                          background: '#eef2ff',
                          color: '#3730a3',
                          padding: '0.15rem 0.5rem',
                          borderRadius: 999
                        }}
                      >
                        {r.branch ?? 'unknown'}
                      </span>
                    </div>
                    <RepoConfigEditor repoName={r.name} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section style={{ width: '100%' }}>
        <UserPreferences />
      </section>
    </main>
  )
}
