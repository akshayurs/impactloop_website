import type { Metadata } from 'next'
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { Nav } from '@/components/nav'
import { Footer } from '@/components/footer'
import { AuthProvider } from '@/lib/auth-context'
import { ReferralCatcher } from '@/components/referral-catcher'
import { SITE_URL } from '@/config/site'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' })

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Impact Loop — apps that build habits that stick', template: '%s — Impact Loop' },
  description:
    'Indie app studio building focused learning apps. CrackLoop turns tech-interview prep into short daily loops.',
  openGraph: { siteName: 'Impact Loop', type: 'website' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <ThemeProvider>
          <AuthProvider>
            <ReferralCatcher />
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-fg"
            >
              Skip to content
            </a>
            <Nav />
            <main id="main" className="min-h-[60vh]">{children}</main>
            <Footer />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
