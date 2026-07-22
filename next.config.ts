import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

// Scoped to the third parties the app actually loads: Razorpay checkout, Google
// sign-in, and Firebase. 'unsafe-inline'/'unsafe-eval' are kept because Next's
// hydration bootstrap and the Razorpay/Firebase SDKs rely on them; everything else
// is locked to 'self'. Verify the sign-in + checkout flows on staging before
// tightening further.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://*.razorpay.com https://apis.google.com https://accounts.google.com https://www.gstatic.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.razorpay.com https://*.googleapis.com https://*.google.com https://*.firebaseio.com wss://*.firebaseio.com https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com",
  "frame-src 'self' https://*.razorpay.com https://checkout.razorpay.com https://accounts.google.com https://*.firebaseapp.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

// tunnelRoute routes browser events through this origin (allowed by connect-src 'self'),
// so CSP and ad-blockers don't drop them. Source-map upload stays off unless SENTRY
// org/project/auth env are provided at build time.
export default withSentryConfig(nextConfig, {
  silent: true,
  tunnelRoute: '/monitoring',
})
