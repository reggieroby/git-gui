import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function DocsPage() {
  return (
    <main style={{
      minHeight: 'calc(100vh - var(--topnav-h))',
      display: 'grid',
      gap: '1rem',
      padding: '2rem',
      maxWidth: 900,
      margin: '0 auto'
    }}>
      <header>
        <h1 style={{ margin: 0 }}>Application Documentation</h1>
        <p style={{ marginTop: 8 }}>Probe endpoints, usage, and references.</p>
      </header>

      <section>
        <h2>Health and Probe Endpoints</h2>
        <p>The app exposes a set of purpose-built endpoints for Kubernetes and observability. Each endpoint is fast, unprivileged, and returns <code>Cache-Control: no-store</code>.</p>
        <ul>
          <li><code>/livez</code> — Liveness: returns 200 if the process is healthy enough to keep running. Does not check external dependencies.</li>
          <li><code>/readyz</code> — Readiness: returns 200 when the app is ready to serve requests (stubbed OK by default; extend to check real deps).</li>
          <li><code>/startupz</code> — Startup: used during cold start for deeper, one-time checks (stubbed OK by default).</li>
          <li><code>/healthz</code> — Composite, human-friendly: returns JSON with status, uptime, and current settings from the settings store.</li>
          <li><code>/metrics</code> — Prometheus metrics in text format (uptime, scrape counter, PID); extend with app metrics as needed.</li>
        </ul>
      </section>

      <section>
        <h3>Expected Status Codes</h3>
        <ul>
          <li>200 OK — healthy/ready</li>
          <li>503 Service Unavailable — not ready (e.g., for <code>/readyz</code> if checks fail)</li>
          <li>500 Internal Server Error — unexpected error while serving the probe</li>
        </ul>
      </section>

      <section>
        <h3>Example Payloads</h3>
        <p><strong>/livez</strong></p>
        <pre>{`{ "status": "ok" }`}</pre>
        <p><strong>/healthz</strong></p>
        <pre>{`{
  "status": "ok",
  "uptime_s": 12345,
  "pid": 1234,
  "checks": { "livez": "ok", "readyz": "ok" },
  "settings": { /* current settings store content */ }
}`}</pre>
        <p><strong>/metrics</strong> (Prometheus text exposition)</p>
        <pre>{`# HELP app_uptime_seconds Application uptime in seconds
# TYPE app_uptime_seconds gauge
app_uptime_seconds 12345
# HELP app_requests_total Total metric scrapes to /metrics
# TYPE app_requests_total counter
app_requests_total 42
# HELP nodejs_process_pid Process ID of the app
# TYPE nodejs_process_pid gauge
nodejs_process_pid 1234
`}</pre>
      </section>

      <section>
        <h2>Kubernetes Probe Wiring (example)</h2>
        <pre>{`containers:
- name: app
  image: your/app:tag
  ports:
    - containerPort: 8080
  startupProbe:
    httpGet: { path: /startupz, port: 8080 }
    periodSeconds: 2
    failureThreshold: 60
    timeoutSeconds: 1
  livenessProbe:
    httpGet: { path: /livez, port: 8080 }
    periodSeconds: 5
    failureThreshold: 3
    timeoutSeconds: 1
  readinessProbe:
    httpGet: { path: /readyz, port: 8080 }
    periodSeconds: 3
    failureThreshold: 2
    timeoutSeconds: 1
`}</pre>
        <p>Tip: keep <code>/livez</code> instant and avoid external calls; let <code>/readyz</code> reflect end-to-end serving readiness; use <code>/startupz</code> for deeper cold-start checks.</p>
      </section>

      <footer style={{ marginTop: 16 }}>
        <Link href="/settings" className="topnav__link">Back to Settings</Link>
      </footer>
    </main>
  )
}

