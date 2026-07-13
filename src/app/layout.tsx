import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/inter'
import './globals.css'
import Providers from '@/components/Providers'

export const metadata: Metadata = {
  metadataBase: new URL('https://impactloopapps.github.io'),
  title: 'Impact Loop — Apps that compound into impact',
  description:
    'Impact Loop is an indie app studio building products that turn everyday effort into a continuous loop of learning and impact. Meet CrackLoop, our flagship interview-prep app.',
  icons: { icon: '/favicon.svg', apple: '/apple-touch-icon.png' },
  openGraph: {
    type: 'website',
    siteName: 'Impact Loop',
    title: 'Impact Loop — Apps that compound into impact',
    description: 'An indie app studio building a continuous loop of learning and impact. Meet CrackLoop.',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
}

export const viewport: Viewport = { themeColor: '#05060A', colorScheme: 'dark' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
