import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Impact Loop',
  description: 'Apps that build habits that stick.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
