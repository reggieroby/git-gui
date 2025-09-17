import Link from 'next/link'

export default function NavBar() {
  return (
    <header className="topnav">
      <div className="topnav__inner">
        <Link href="/" className="topnav__brand" aria-label="GIT GUI Home">
          <span className="topnav__logo">GIT GUI</span>
        </Link>
        <nav className="topnav__nav" aria-label="Primary">
          <Link href="/repositories" className="topnav__link">Repositories</Link>
          <Link href="/settings" className="topnav__link">Settings</Link>
        </nav>
      </div>
    </header>
  )
}
