# Impact Loop — website

Marketing site for **Impact Loop**, an indie app studio, featuring its flagship product
**CrackLoop**. An animation-heavy, single-page experience: an interactive 3D hero, scroll-driven
reveals, particle systems, and tasteful micro-interactions — built to feel like a top-tier product
site while staying fast and accessible.

**Live:** https://impactloopapps.github.io/website/ — the GitHub Pages site (branch
`main`) remains the live marketing site until cutover. This branch
(`feat/unified-nextjs-portal`) is a Next.js rewrite deployed to a **Vercel preview**;
it adds a unified portal (auth / cross-app subscriptions / creator / admin), in
progress. See [Status](#status).

## Stack

| Concern | Choice |
| --- | --- |
| Framework | [Next.js 14](https://nextjs.org) (App Router) + React 18 + TypeScript |
| Hosting | [Vercel](https://vercel.com) — see [docs/DEPLOY.md](docs/DEPLOY.md) |
| Auth | [Firebase](https://firebase.google.com) — Google sign-in |
| 3D | [Three.js](https://threejs.org) via [React Three Fiber](https://r3f.docs.pmnd.rs) + drei |
| Post-processing | `@react-three/postprocessing` (bloom, chromatic aberration, vignette) |
| Shaders | Custom GLSL — simplex-noise displacement + iridescent fresnel; GPU particle loop |
| Scroll / animation | [GSAP](https://gsap.com) + ScrollTrigger, [Lenis](https://lenis.darkroom.engineering) smooth scroll |
| Styling | Tailwind CSS |
| Fonts | Self-hosted via Fontsource (Space Grotesk + Inter) — no external CDN |

### Highlights

- Interactive morphing **torus-knot ("the loop")** hero with mouse/touch parallax + post FX.
- GPU **particle field** shaped into a loop, swirling and pointer-reactive.
- Scroll-linked SVG path draw, sticky "method" section, bento feature grid, animated counters,
  infinite marquee, custom cursor, magnetic buttons, 3D-tilt cards, split-text reveals.
- **Mobile-first & performant:** adaptive DPR + particle counts on low-power devices, render loop
  paused when off-screen or the tab is hidden, lazy-loaded 3D, self-hosted fonts (no layout shift).
- **Graceful fallbacks:** static gradient hero when WebGL is unavailable; all motion disabled under
  `prefers-reduced-motion`.

## Run locally

Requires Node 20+ and [pnpm](https://pnpm.io). Copy `.env.local.example` to
`.env.local` and fill in the `NEXT_PUBLIC_FIREBASE_*` values for Google sign-in.

```bash
pnpm install
pnpm dev        # Next.js dev server at http://localhost:3000
pnpm build      # production build (.next)
pnpm start      # serve the production build locally
pnpm typecheck  # TypeScript, no emit
pnpm test       # Vitest
pnpm assets     # regenerate favicon/OG PNGs from SVG (needs sharp)
```

Routes: `/` (marketing) and `/account` (auth-gated subscription portal). Static legal
and icon assets live in `public/` and are served at the site root (`/terms.html`,
`/privacy.html`, `/favicon.svg`, …).

## Deployment

This branch deploys to **Vercel** (Next.js preset) — see
[docs/DEPLOY.md](docs/DEPLOY.md) for the Vercel project setup, required env vars, and
the Firebase authorized-domains step.

Until cutover, `main` continues to serve the **live marketing site** via GitHub Pages:
pushing to `main` triggers [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
(build → upload `dist/` as a Pages artifact → publish). When the portal is ready, this
branch merges to `main` and Vercel becomes the production deploy.

## Status

Phase 1 (foundation) on `feat/unified-nextjs-portal`: Next.js scaffold, marketing 3D
port, Firebase Google auth, vendored app registry, and an auth-gated `/account` page.
Phase 2 adds cross-app subscriptions (Razorpay), and creator/admin portals. `main` +
GitHub Pages stay live throughout.

## Structure

```
src/
  app/          App Router: layout.tsx (root + metadata), page.tsx (/), 
                account/page.tsx (protected), globals.css
  components/   React components: MarketingPage, Providers, AuthButton,
                Cursor, Magnetic, SplitText, TiltCard, Marquee, Counter, Reveal, Nav, Footer, Logo
  sections/     Marketing page sections: Hero, Concept, CrackLoop, Features, Stats, 
                Process, ParticlesSection, CTA
  three/        R3F scenes, meshes, shaders: HeroCanvas, LoopMesh, Particles, ParticleScene
  lib/          firebase.ts (client SDK init), auth.tsx (Google auth context),
                smooth-scroll, reduced-motion, WebGL, in-view hooks
  config/       apps.ts (vendored app registry)
public/         Static assets, legal pages (terms.html, privacy.html), icons, OG image
scripts/        make-assets.mjs (SVG → OG/icon PNGs)
docs/           Design spec, plans, DEPLOY.md, registry-sync.md
```

## Contact

[impactloopapps@gmail.com](mailto:impactloopapps@gmail.com)
