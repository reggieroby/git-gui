import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'git-gui',
  description: 'Next.js app scaffolded in git-gui'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}

