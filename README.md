# Impact Loop — website

Marketing site and unified portal for **Impact Loop**, an indie app studio, featuring its
flagship product **CrackLoop**. Home, per-app pages, pricing, and an auth-gated
account portal — fast, accessible, and light on JavaScript.

**Live:** deployed on [Vercel](https://vercel.com).

## Stack

| Concern | Choice |
| --- | --- |
| Framework | [Next.js 15](https://nextjs.org) (App Router) + React + TypeScript |
| Hosting | [Vercel](https://vercel.com) — see [docs/DEPLOY.md](docs/DEPLOY.md) |
| Auth | [Firebase](https://firebase.google.com) — Google sign-in |
| Billing | Planned — Razorpay (see [docs/superpowers/specs](docs/superpowers/specs)) |
| Styling | Tailwind CSS 4 |
| Animation | CSS-only transitions and keyframes — no 3D, no scroll-animation libraries |
| Fonts | `next/font` (Space Grotesk + Inter) |

### Highlights

- App Router server components throughout: marketing pages, per-app pages, pricing, legal pages,
  sitemap, and robots.
- Firebase Google auth gating `/account`.
- Static pricing display; checkout and subscription management planned.
- Light and dark themes; all motion respects `prefers-reduced-motion`.

## Run locally

Requires Node 20+ and [pnpm](https://pnpm.io). Copy `.env.local.example` to
`.env.local` and fill in the `NEXT_PUBLIC_FIREBASE_*` values (see `.env.local.example`).

```bash
pnpm install
pnpm dev        # Next.js dev server at http://localhost:3000
pnpm build      # production build (.next)
pnpm start      # serve the production build locally
pnpm typecheck  # TypeScript, no emit
pnpm test       # Vitest
```

Routes: `/` (marketing), `/apps/[appId]`, `/pricing`, `/terms`, `/privacy`, and
`/account` (auth-gated). `/sitemap.xml` and `/robots.txt` are generated at build time.

## Deployment

Deploys to **Vercel** (Next.js preset) — see [docs/DEPLOY.md](docs/DEPLOY.md) for
project setup, required env vars, and the Firebase authorized-domains step.

## Docs

Specs and implementation plans for this rewrite live under
[docs/superpowers/specs](docs/superpowers/specs) and
[docs/superpowers/plans](docs/superpowers/plans).

## Structure

```
src/
  app/          App Router: layout.tsx (root + metadata), page.tsx (/), pricing/,
                terms/, privacy/, account/ (protected), apps/[appId]/, sitemap.ts,
                robots.ts, not-found.tsx, globals.css
  components/   Nav, Footer, ThemeProvider, ui/ (Button, ...)
  lib/          firebase/ (client SDK init), auth-context.tsx (Google auth context)
  config/       apps.ts (app registry), site.ts (SITE_URL), plans.ts
public/         Static assets: favicon, apple-touch-icon, OG image
docs/           Design specs, plans, DEPLOY.md
```

## Contact

[impactloopapps@gmail.com](mailto:impactloopapps@gmail.com)
