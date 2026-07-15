# Deploy (Vercel)

## Project setup

- Vercel project is connected to this GitHub repo (`impactloop_website`).
- **Production branch: `feat/unified-nextjs-portal`** — not `main`. `main` keeps
  deploying the existing Vite site to GitHub Pages
  ([.github/workflows/deploy.yml](/.github/workflows/deploy.yml)) until the unified
  Next.js portal is ready to cut over, at which point this branch merges to `main` and
  the production branch setting flips back.
- Framework preset: **Next.js** (see [vercel.json](/vercel.json) — `buildCommand: next
  build`, `installCommand: pnpm install`).
- Every push to the production branch triggers a production deploy; every other branch
  and PR gets a preview deploy on a generated `*.vercel.app` URL.

## Required environment variables

Set these in the Vercel project (Settings → Environment Variables) for both
**Production** and **Preview**. Values come from the Firebase project's web app config
— see [.env.local.example](/.env.local.example) for local dev.

| Variable | Source |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase console → Project settings → General → Web app |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase console → Project settings → General → Web app |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase console → Project settings → General → Web app |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase console → Project settings → General → Web app |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase console → Project settings → General → Web app |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase console → Project settings → General → Web app |

**Phase 2** (billing + creator/admin portals) will add server-side vars once that work
lands: `RAZORPAY_*` (key id/secret, webhook secret) and `FIREBASE_SERVICE_ACCOUNT`
(for server-side Firestore/Auth admin access). Not required for phase-1 deploy.

## Firebase Auth: authorized domains

Google sign-in (`src/lib/firebase.ts`, used by `/account`) validates the requesting
origin against Firebase Auth's authorized domain allowlist. After the first Vercel
deploy:

1. Firebase console → Authentication → Settings → **Authorized domains**.
2. Add the Vercel preview/production domain(s), e.g. `impactloop-website.vercel.app`
   and any per-branch preview domain in active use.
3. Without this step, `signInWithPopup`/`signInWithRedirect` fails with
   `auth/unauthorized-domain` on the deployed site even though it works on
   `localhost`.

## Static assets

`public/` is served at the site root by Next.js as-is — `terms.html`, `privacy.html`,
`favicon.svg`, `apple-touch-icon.png`, `og.png`, and `404.html` all deploy unchanged,
no rewrite rules needed.
