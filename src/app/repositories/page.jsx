import Link from 'next/link'
import { listLocalRepositories } from '@/lib/repos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function RepositoriesPage() {
  const repos = await listLocalRepositories()
  return (
    <main style={{
      minHeight: 'calc(100vh - var(--topnav-h))',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      flexDirection: 'column',
      gap: '1.5rem',
      padding: '2rem'
    }}>
      <section>
        <h1 style={{ margin: 0 }}>Repositories</h1>
        <p style={{ marginTop: '0.5rem' }}>Local repositories discovered under <code>/srv/repositories</code>.</p>
      </section>

      <section>
        <h2 style={{ marginBottom: '0.5rem' }}>Local repositories</h2>
        {repos.length === 0 ? (
          <p style={{ opacity: 0.8 }}>No repositories found at <code>/srv/repositories</code>.</p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'grid',
              gap: '0.75rem',
              maxWidth: 900,
              width: '100%'
            }}
          >
            {repos.map((r) => (
              <li
                key={r.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: '0.75rem 1rem',
                  background: '#fff',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                }}
              >
                <Link
                  href={`/repositories/${encodeURIComponent(r.name)}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    textDecoration: 'none',
                    color: 'inherit',
                    width: '100%'
                  }}
                >
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
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

