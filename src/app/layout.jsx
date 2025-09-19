import './globals.css'
import NavBar from '@/components/NavBar'

export const metadata = {
  title: 'git-gui',
  description: 'Next.js app scaffolded in git-gui'
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        {children}
      </body>
    </html>
  )
}
