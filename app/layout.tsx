import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cold Lava Audit Tool — Free Website & Review Analysis',
  description: 'Get a comprehensive audit of your website performance, online reviews, trust signals, and competitive positioning. Powered by Cold Lava.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-cl-darker antialiased">
        {children}
      </body>
    </html>
  )
}
