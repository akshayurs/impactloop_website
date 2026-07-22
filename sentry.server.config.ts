import * as Sentry from '@sentry/nextjs'

// Inert unless SENTRY_DSN is set, so local dev and unconfigured deploys stay quiet.
const dsn = process.env.SENTRY_DSN

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0.1,
})
