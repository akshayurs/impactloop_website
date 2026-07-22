# Deploy (Vercel)

## Project setup

- Vercel project is connected to this GitHub repo (`impactloop_website`).
- **Production branch** is set in Vercel (Settings → Git → Production Branch). Confirm the
  current value there before a cutover — historically this was `feat/unified-nextjs-portal`
  while `main` still deployed the legacy Vite site to GitHub Pages
  ([.github/workflows/deploy.yml](/.github/workflows/deploy.yml)).
- Framework preset: **Next.js** ([vercel.json](/vercel.json) — `buildCommand: next build`,
  `installCommand: pnpm install`).
- Every push to the production branch triggers a production deploy; every other branch and
  PR gets a preview deploy on a generated `*.vercel.app` URL.

## Environment variables

Set these in Vercel (Settings → Environment Variables) for both **Production** and
**Preview**. Local dev reads them from `.env.local` (see
[.env.local.example](/.env.local.example)). Anything with a `NEXT_PUBLIC_` prefix is exposed
to the browser — never put a secret behind that prefix.

### Client — Firebase web config (required)

| Variable | Source |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase console → Project settings → General → Web app |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase console → Project settings → General → Web app |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase console → Project settings → General → Web app |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase console → Project settings → General → Web app |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase console → Project settings → General → Web app |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase console → Project settings → General → Web app |
| `NEXT_PUBLIC_SITE_URL` | The canonical production URL, e.g. `https://impactloop.app`. **Set this in production** — it feeds `metadataBase`, canonical URLs, the sitemap, OG/Twitter image URLs, and signed unsubscribe links. Falls back to `https://impactloop.vercel.app` if unset ([src/config/site.ts](/src/config/site.ts)). |

### Server — core (required for payments, auth, admin)

| Variable | Source / notes |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase console → Project settings → Service accounts → *Generate new private key*. Paste the **entire JSON** as one value. Used for all server-side Firestore/Auth (Admin SDK). |
| `RAZORPAY_KEY_ID` | Razorpay dashboard → Settings → API Keys (also returned to the client to open checkout — this is the publishable key). |
| `RAZORPAY_KEY_SECRET` | Razorpay dashboard → API Keys. Signs/verifies payments; never exposed to the client. |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay dashboard → Settings → Webhooks (see “Razorpay webhook” below). Verifies the webhook HMAC. |

### Server — email (see [EMAILS.md](EMAILS.md))

| Variable | Source / notes |
| --- | --- |
| `GMAIL_USER` | Gmail address emails are sent from (e.g. `impactloopapps@gmail.com`). |
| `GMAIL_APP_PASSWORD` | Google Account → Security → 2-Step Verification → App passwords. |
| `EMAIL_UNSUB_SECRET` | Long random string (`openssl rand -hex 32`); signs unsubscribe links. **Required for any email to send.** |
| `PAYMENTS_EMAIL` | Where partner payout-request alerts go. Unset → those alerts are skipped. |
| `EMAIL_PROVIDER` | Optional; defaults to `gmail`. Set to `resend` to send via Resend ([mailer.ts](/src/lib/server/email/mailer.ts)). |
| `RESEND_API_KEY` | Required only when `EMAIL_PROVIDER=resend`. Also set `EMAIL_FROM` to a sender on a Resend-verified domain. |
| `EMAIL_FROM` | Optional; overrides the default `"Impact Loop" <GMAIL_USER>` From header. |

### Server — cron

| Variable | Source / notes |
| --- | --- |
| `CRON_SECRET` | Long random string. Vercel Cron sends it as `Authorization: Bearer <CRON_SECRET>`; the reminder route rejects anything else. |

### Server — observability & abuse protection (optional; inert until set)

| Variable | Source / notes |
| --- | --- |
| `SENTRY_DSN` | Sentry project DSN (server/edge). Without it, Sentry is fully disabled — no network calls. |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for the browser SDK. Usually the same DSN as above. |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL. Enables per-IP rate limiting in [middleware.ts](/src/middleware.ts). |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token. |
| `NEXT_PUBLIC_GA_ID` | GA4 measurement id (e.g. `G-XXXXXXX`). Without it, no analytics script loads. |

If the Upstash pair is absent, the rate-limit middleware passes every request through (no
limiting) — safe for local dev and early production.

Optional source-map upload for Sentry (nicer stack traces) needs `SENTRY_AUTH_TOKEN` +
org/project configured in `withSentryConfig` ([next.config.ts](/next.config.ts)); it is off
by default and not required to capture errors.

## Razorpay webhook

1. Razorpay dashboard → Settings → Webhooks → **Add webhook**.
2. URL: `https://<prod-domain>/api/razorpay/webhook`.
3. Secret: the same value as `RAZORPAY_WEBHOOK_SECRET`.
4. Subscribe to at least: `order.paid`, `subscription.activated`, `subscription.charged`,
   `subscription.cancelled`, `subscription.halted`, `subscription.paused`,
   `subscription.resumed`, `subscription.completed`, **`refund.created` / `refund.processed`**
   (refunds revoke access and reverse partner commission — [webhook route](/src/app/api/razorpay/webhook/route.ts)).

## Firestore rules & indexes

Deploy these from the Firebase CLI (or your Firestore deploy pipeline) — they are not part of
the Vercel build:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

- Rules ([firestore.rules](/firestore.rules)) are deny-all — all access is via the Admin SDK.
- Indexes ([firestore.indexes.json](/firestore.indexes.json)) back the referral, payout, and
  enrollment queries. Deploy after any query change or the admin/portal lists will error.

## Cron

`vercel.json` schedules the expiry-reminder job:

- `GET /api/cron/email-reminders` daily at `30 3 * * *` (UTC).
- Vercel Cron authenticates with `CRON_SECRET`. It only sends within the reminder window and
  is idempotent (deduped per `{uid, appId, expiry}`), so a retried run won’t double-send.

## Firebase Auth: authorized domains

Google sign-in validates the requesting origin against Firebase Auth’s allowlist. After the
first deploy:

1. Firebase console → Authentication → Settings → **Authorized domains**.
2. Add the production domain and any preview domain in active use (e.g.
   `impactloop-website.vercel.app`).
3. Without this, `signInWithPopup` fails with `auth/unauthorized-domain` on the deployed site
   even though it works on `localhost`.

## Security headers & CSP

[next.config.ts](/next.config.ts) sends HSTS, `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, `Permissions-Policy`, and a Content-Security-Policy scoped to the third
parties the app loads (Razorpay checkout, Google sign-in, Firebase). The Sentry browser SDK
reports through a same-origin tunnel at `/monitoring` so CSP/ad-blockers don’t drop events.

> **Before trusting the CSP in production, smoke-test Google sign-in and a full Razorpay
> checkout on a preview/staging deploy.** These flows open third-party popups/iframes that a
> too-strict CSP can silently break; the allowed origins are set but must be confirmed live.
> If a legitimate origin is blocked, add it to the relevant CSP directive in `next.config.ts`.

## Build notes

- **`pnpm install` must exit clean.** [pnpm-workspace.yaml](/pnpm-workspace.yaml) sets
  `allowBuilds['@sentry/cli']: false` — we don’t need the sentry-cli binary (no source-map
  upload), and this stops pnpm from failing on its ignored build script.
- A build warning that `@upstash/redis` uses a Node API in the Edge runtime is **benign** —
  the limiter is only instantiated when the Upstash env vars are set, and Upstash’s client is
  Edge-compatible in that path.
- If a local `next dev` shows stale module-resolution errors after dependency changes, clear
  the cache: `rm -rf .next`. Vercel always builds clean, so this is a local-only concern.

## Static assets

`public/` is served at the site root as-is. The favicon (`favicon.svg`,
`apple-touch-icon.png`) and social image (`og.png`) are wired through Next metadata in
[layout.tsx](/src/app/layout.tsx) — no manual `<link>` tags needed.

## Pre-cutover checklist

1. All env vars above set for Production (and Preview).
2. `pnpm test` and `pnpm build` green locally.
3. Firestore rules + indexes deployed.
4. Razorpay webhook configured and a **test-mode** payment verified end-to-end (checkout →
   entitlement granted → receipt email → referral commission recorded).
5. Google sign-in works on the deployed domain (authorized domains added).
6. Full checkout + sign-in verified under the production CSP.
7. `NEXT_PUBLIC_SITE_URL` points at the real domain (check the sitemap and an OG preview).
