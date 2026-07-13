# Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the unified Next.js site — port the full 3D marketing experience, add Firebase Google auth, a protected account page, and the vendored app registry — deployable standalone to Vercel with zero backend dependencies.

**Architecture:** Next.js 14 App Router (`src/app/`) reusing the existing React 18 marketing components (`src/components`, `src/sections`, `src/three`, `src/lib`) in place. WebGL/GSAP components are client-only (`'use client'`, `next/dynamic` with `ssr:false`). Firebase JS SDK provides Google auth via a client context provider. No server routes, no Razorpay, no Firestore writes yet.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS 3, Three.js/@react-three/fiber v8/drei, GSAP + ScrollTrigger, Lenis, Firebase JS SDK v10, Vitest.

## Global Constraints

- **Next.js 14 + React 18** — do NOT upgrade to Next 15 / React 19 (keeps @react-three/fiber v8 + drei v9 working unchanged). Copy versions verbatim: `next@^14.2`, `react@^18.3.1`, `react-dom@^18.3.1`.
- **Router dir is `src/app/`** (Next auto-detects). Existing `src/{components,sections,three,lib}` stay in place and are imported as-is.
- **No CDN / external hosts** — self-host fonts (Fontsource imports, already vendored) and all assets (`public/`).
- **Preserve graceful fallbacks:** static gradient hero when WebGL unavailable; all motion off under `prefers-reduced-motion`; adaptive DPR/particle counts on low-power devices. Do not remove existing guards.
- **`main` and GitHub Pages stay untouched** — all work is on `feat/unified-nextjs-portal`.
- **Tailwind theme is authoritative** — port `tailwind.config.js` colors/fonts/maxWidth verbatim (ink/ink2/ink3, aurora.*, display/sans, maxWidth.content).
- **Firebase project:** `impactloop-apps`. Client config via `NEXT_PUBLIC_FIREBASE_*` env vars only — never commit keys.
- Tests: pure logic (`*.test.ts`) via Vitest. UI/IO verified by `tsc --noEmit` + `next build`. Commit after each task.

---

### Task 1: Next.js scaffold, Tailwind, layout & fonts

Replace the Vite toolchain with Next 14 on this branch, port the Tailwind theme and global CSS, and render an empty themed shell that builds.

**Files:**
- Create: `next.config.mjs`, `src/app/layout.tsx`, `src/app/page.tsx` (temporary placeholder), `next-env.d.ts` (auto-generated — do not hand-edit)
- Modify: `package.json` (scripts + deps), `tsconfig.json` (Next preset), `tailwind.config.js` (content globs), `postcss.config.js` (keep), `.gitignore` (add `.next/`, `.vercel/`)
- Move: `src/index.css` → `src/app/globals.css`
- Delete: `index.html`, `vite.config.ts`, `tsconfig.node.json`, `src/main.tsx`, `src/App.tsx`

**Interfaces:**
- Produces: a working `npm run dev` / `npm run build`; `src/app/layout.tsx` exporting the root layout with `<html lang="en">`, dark theme, fonts, and metadata; `globals.css` with the existing Tailwind directives + custom classes (`.grain`, etc.).

- [ ] **Step 1: Rewrite `package.json`**

```json
{
  "name": "impact-loop-website",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "description": "Impact Loop — unified marketing site + subscription/creator portal.",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "assets": "node scripts/make-assets.mjs"
  },
  "dependencies": {
    "@react-three/drei": "^9.114.0",
    "@react-three/fiber": "^8.17.10",
    "@react-three/postprocessing": "^2.16.3",
    "firebase": "^10.13.0",
    "gsap": "^3.12.5",
    "lenis": "^1.1.18",
    "next": "^14.2.15",
    "postprocessing": "^6.36.4",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "three": "^0.169.0"
  },
  "devDependencies": {
    "@fontsource-variable/inter": "^5.1.1",
    "@fontsource-variable/space-grotesk": "^5.1.1",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@types/three": "^0.169.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "sharp": "^0.33.5",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.6.3",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Install**

Run: `cd /Users/akshayursm/Desktop/proj/impactloop_website && pnpm install`
Expected: resolves, adds `next`, `firebase`, `vitest`, removes `vite`.

- [ ] **Step 3: Create `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing', 'postprocessing'],
}
export default nextConfig
```

- [ ] **Step 4: Replace `tsconfig.json` with the Next preset**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Delete Vite files & move CSS**

```bash
git rm index.html vite.config.ts tsconfig.node.json src/main.tsx src/App.tsx
git mv src/index.css src/app/globals.css
```
(If `src/app/` doesn't exist yet, create it first: `mkdir -p src/app` then `git mv src/index.css src/app/globals.css`.)

- [ ] **Step 6: Update `tailwind.config.js` content globs**

Change the `content` array to:
```js
content: ['./src/**/*.{ts,tsx}'],
```
Leave the `theme.extend` block (ink/aurora colors, fonts, maxWidth) exactly as-is.

- [ ] **Step 7: Create `src/app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/inter'
import './globals.css'

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
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 8: Create temporary `src/app/page.tsx`**

```tsx
export default function Home() {
  return <main className="min-h-screen bg-ink text-white grid place-items-center">Impact Loop — scaffold OK</main>
}
```

- [ ] **Step 9: Verify build**

Run: `pnpm build`
Expected: `✓ Compiled successfully`, route `/` generated, no type errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 14 app, port Tailwind theme + layout"
```

---

### Task 2: Port the 3D marketing experience to `/`

Reuse every existing marketing component/section/shader in place; render them from the App Router with client-only WebGL and smooth-scroll.

**Files:**
- Create: `src/components/MarketingPage.tsx` (client), `src/app/page.tsx` (server wrapper, replaces the placeholder)
- Modify: `src/components/Footer.tsx` (fix the Vite `import.meta.env.BASE_URL` links), and add `'use client'` to the entry client components that use hooks/WebGL (see step 3)

**Interfaces:**
- Consumes: existing `src/sections/*`, `src/three/*`, `src/components/*`, `src/lib/useSmoothScroll.ts` (unchanged API: `useSmoothScroll()`, `scrollToSection(target)`).
- Produces: the full marketing page at `/`, SSR-safe (no WebGL during server render).

- [ ] **Step 1: Create `src/components/MarketingPage.tsx`** — the ported `App.tsx` body as a client component

```tsx
'use client'

import Cursor from './Cursor'
import GradientMesh from './GradientMesh'
import Nav from './Nav'
import Footer from './Footer'
import Marquee from './Marquee'
import Hero from '../sections/Hero'
import Concept from '../sections/Concept'
import CrackLoop from '../sections/CrackLoop'
import Features from '../sections/Features'
import Stats from '../sections/Stats'
import Process from '../sections/Process'
import ParticlesSection from '../sections/ParticlesSection'
import CTA from '../sections/CTA'
import { useSmoothScroll } from '../lib/useSmoothScroll'

const MARQUEE = ['Learn', 'Build', 'Loop', 'Compound', 'Ship', 'Reflect', 'Repeat']

export default function MarketingPage() {
  useSmoothScroll()
  return (
    <div className="grain relative">
      <GradientMesh />
      <Cursor />
      <Nav />
      <main>
        <Hero />
        <div className="border-y border-white/10 py-6">
          <Marquee items={MARQUEE} duration={28} />
        </div>
        <Concept />
        <CrackLoop />
        <Features />
        <Stats />
        <Process />
        <ParticlesSection />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
```

- [ ] **Step 2: Replace `src/app/page.tsx`** — load the marketing page client-only

```tsx
import dynamic from 'next/dynamic'

const MarketingPage = dynamic(() => import('@/components/MarketingPage'), { ssr: false })

export default function Home() {
  return <MarketingPage />
}
```

- [ ] **Step 3: Add `'use client'` to interactive components**

Add `'use client'` as the first line of each file that uses React hooks, `window`/`document`, WebGL, or GSAP. Audit and mark ALL of:
`src/components/{Cursor,GradientMesh,Nav,Footer,Marquee,Counter,Reveal,Magnetic,SplitText,TiltCard,Logo}.tsx`, all `src/sections/*.tsx`, all `src/three/*.tsx`.
Any pure presentational file with no hooks/browser API may stay server, but when unsure, mark it client. (`src/three/shaders.ts` and `src/lib/*.ts` are plain modules — no directive needed.)

- [ ] **Step 4: Fix `src/components/Footer.tsx` legal links**

Replace the two `import.meta.env.BASE_URL`-based hrefs:
```tsx
href={`${import.meta.env.BASE_URL}terms.html`}
href={`${import.meta.env.BASE_URL}privacy.html`}
```
with root-absolute paths:
```tsx
href="/terms.html"
href="/privacy.html"
```

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: no errors. (Fix any leftover `import.meta` references or missing `'use client'` boundaries it surfaces.)

- [ ] **Step 6: Build**

Run: `pnpm build`
Expected: compiles; `/` present. WebGL code is inside the `ssr:false` island so it never runs server-side.

- [ ] **Step 7: Manual smoke test**

Run: `pnpm dev`, open `http://localhost:3000`.
Expected: 3D hero renders, scroll is smooth (Lenis), sections reveal, marquee scrolls, cursor works. Toggle OS "reduce motion" → animations disabled, static hero. Confirm no console errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: port 3D marketing experience to Next App Router"
```

---

### Task 3: Firebase client init + Google auth provider

Initialize the Firebase JS SDK and expose auth state + sign-in/out through a client context; wire a sign-in control into the nav.

**Files:**
- Create: `src/lib/firebase.ts`, `src/lib/auth.tsx` (`AuthProvider` + `useAuth`), `src/components/AuthButton.tsx`, `.env.local.example`
- Modify: `src/components/MarketingPage.tsx` (wrap in `AuthProvider`) OR `src/app/layout.tsx` — provider goes in a client boundary (see step 4); `src/components/Nav.tsx` (render `<AuthButton/>`)

**Interfaces:**
- Produces:
  - `src/lib/firebase.ts` → exports `firebaseApp`, `auth`, `db` (Firestore), lazily initialized, guarded for repeated import.
  - `src/lib/auth.tsx` → `AuthProvider` (client) and `useAuth(): { user: User | null; loading: boolean; signIn(): Promise<void>; signOutUser(): Promise<void> }`.

- [ ] **Step 1: Create `.env.local.example`**

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=impactloop-apps.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=impactloop-apps
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=impactloop-apps.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```
Then create a real `.env.local` (git-ignored) with the actual values from the Firebase console → Project settings → Web app. Confirm `.env*.local` is git-ignored (Next's default `.gitignore` covers it; add if missing).

- [ ] **Step 2: Create `src/lib/firebase.ts`**

```ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

export const firebaseApp: FirebaseApp = getApps().length ? getApp() : initializeApp(config)
export const auth: Auth = getAuth(firebaseApp)
export const db: Firestore = getFirestore(firebaseApp)
```

- [ ] **Step 3: Create `src/lib/auth.tsx`**

```tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { auth } from './firebase'

type AuthState = {
  user: User | null
  loading: boolean
  signIn: () => Promise<void>
  signOutUser: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false) }), [])

  const signIn = async () => { await signInWithPopup(auth, new GoogleAuthProvider()) }
  const signOutUser = async () => { await signOut(auth) }

  return <AuthContext.Provider value={{ user, loading, signIn, signOutUser }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

- [ ] **Step 4: Provide auth app-wide via a client Providers wrapper**

Create `src/components/Providers.tsx`:
```tsx
'use client'
import { AuthProvider } from '@/lib/auth'
export default function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
```
Wrap `children` with it in `src/app/layout.tsx`: `<body><Providers>{children}</Providers></body>` (import `Providers` at top).

- [ ] **Step 5: Create `src/components/AuthButton.tsx`**

```tsx
'use client'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'

export default function AuthButton() {
  const { user, loading, signIn, signOutUser } = useAuth()
  if (loading) return null
  if (!user)
    return (
      <button onClick={() => signIn()} className="rounded-full border border-white/20 px-4 py-1.5 text-sm hover:bg-white/10">
        Sign in
      </button>
    )
  return (
    <div className="flex items-center gap-3 text-sm">
      <Link href="/account" className="hover:underline">Account</Link>
      <button onClick={() => signOutUser()} className="rounded-full border border-white/20 px-4 py-1.5 hover:bg-white/10">
        Sign out
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Render `<AuthButton/>` in `src/components/Nav.tsx`**

Import `AuthButton` and place it in the nav's action area (right side). Keep existing nav styling/links; just add the control.

- [ ] **Step 7: Typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: passes.

- [ ] **Step 8: Manual auth test**

With a real `.env.local`, run `pnpm dev`. Click **Sign in** → Google popup → returns signed-in; nav shows Account + Sign out. Reload → still signed in (persistence). Sign out → back to Sign in.
(In the Firebase console, add `localhost` to Auth → Settings → Authorized domains if not present.)

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: firebase client + Google auth provider and nav control"
```

---

### Task 4: Vendored app registry + typed lookups (TDD)

A local, hand-synced copy of the app registry with pure lookup helpers.

**Files:**
- Create: `src/config/apps.ts`, `src/config/apps.test.ts`, `docs/registry-sync.md`

**Interfaces:**
- Produces:
  - `type AppRegistryEntry = { appId: string; displayName: string; contentRepo: string; playProductIds: { pro: string; ai: string }; razorpayPlanIds: { pro: string | null; ai: string | null }; theme: { primary: string; accent: string } }`
  - `const APPS: Record<string, AppRegistryEntry>`
  - `getApp(appId: string): AppRegistryEntry | undefined`
  - `listApps(): AppRegistryEntry[]`

- [ ] **Step 1: Write the failing test — `src/config/apps.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { APPS, getApp, listApps } from './apps'

describe('app registry', () => {
  it('contains the crackloop entry with required fields', () => {
    const e = getApp('crackloop')
    expect(e).toBeDefined()
    expect(e!.displayName).toBe('CrackLoop')
    expect(e!.playProductIds.pro).toMatch(/pro/)
  })
  it('returns undefined for unknown appId', () => {
    expect(getApp('nope')).toBeUndefined()
  })
  it('listApps returns all entries', () => {
    expect(listApps().length).toBe(Object.keys(APPS).length)
    expect(listApps().every((a) => a.appId && a.displayName)).toBe(true)
  })
})
```

- [ ] **Step 2: Run it — verify it fails**

Run: `pnpm test src/config/apps.test.ts`
Expected: FAIL — cannot resolve `./apps`.

- [ ] **Step 3: Implement `src/config/apps.ts`**

```ts
export type AppRegistryEntry = {
  appId: string
  displayName: string
  contentRepo: string
  playProductIds: { pro: string; ai: string }
  razorpayPlanIds: { pro: string | null; ai: string | null }
  theme: { primary: string; accent: string }
}

// Synced by hand from StudyAppTemplate/app/assets/flavors/*.json — see docs/registry-sync.md.
export const APPS: Record<string, AppRegistryEntry> = {
  crackloop: {
    appId: 'crackloop',
    displayName: 'CrackLoop',
    contentRepo: 'impactloopapps/CrackLoopData',
    playProductIds: { pro: 'crackloop_pro_monthly', ai: 'ai_monthly' },
    razorpayPlanIds: { pro: null, ai: null },
    theme: { primary: '#7C5CFF', accent: '#22D3EE' },
  },
}

export function getApp(appId: string): AppRegistryEntry | undefined {
  return APPS[appId]
}

export function listApps(): AppRegistryEntry[] {
  return Object.values(APPS)
}
```
(Verify `playProductIds` and `contentRepo` against `StudyAppTemplate/app/assets/flavors/crackloop.json`; correct them if they differ. `razorpayPlanIds` stay `null` until phase 2 provisions Razorpay plans.)

- [ ] **Step 4: Run tests — verify pass**

Run: `pnpm test src/config/apps.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write `docs/registry-sync.md`**

Document: the registry is a manual copy; when a flavor is added/changed in `StudyAppTemplate/app/assets/flavors/*.json`, add/update the matching `APPS` entry (appId, displayName, content repo, Play product ids from the `subscriptions` block, theme colors); fill `razorpayPlanIds` when Razorpay plans exist.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: vendored app registry with typed lookups + tests"
```

---

### Task 5: Protected account page

A `/account` route that shows the signed-in user's profile and the app cards from the registry; redirects to `/` when signed out.

**Files:**
- Create: `src/app/account/page.tsx` (server), `src/components/AccountView.tsx` (client)

**Interfaces:**
- Consumes: `useAuth()` from `src/lib/auth.tsx`; `listApps()` from `src/config/apps.ts`.
- Produces: the `/account` route.

- [ ] **Step 1: Create `src/app/account/page.tsx`**

```tsx
import dynamic from 'next/dynamic'
const AccountView = dynamic(() => import('@/components/AccountView'), { ssr: false })
export default function AccountPage() {
  return <AccountView />
}
```

- [ ] **Step 2: Create `src/components/AccountView.tsx`**

```tsx
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { listApps } from '@/config/apps'

export default function AccountView() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/')
  }, [loading, user, router])

  if (loading || !user) return <main className="min-h-screen bg-ink text-white grid place-items-center">Loading…</main>

  return (
    <main className="min-h-screen bg-ink text-white px-6 py-16">
      <div className="mx-auto max-w-content">
        <h1 className="font-display text-3xl mb-2">Your account</h1>
        <p className="text-white/60 mb-10">{user.displayName} · {user.email}</p>
        <h2 className="font-display text-xl mb-4">Apps</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listApps().map((app) => (
            <div key={app.appId} className="rounded-2xl border border-white/10 p-5" style={{ background: `${app.theme.primary}14` }}>
              <div className="font-display text-lg">{app.displayName}</div>
              <div className="text-white/50 text-sm mt-1">No active subscription</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
```
(The "No active subscription" line is a phase-1 placeholder; phase 2 replaces it with the real per-app entitlement read.)

- [ ] **Step 3: Typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: passes; `/account` route present.

- [ ] **Step 4: Manual test**

`pnpm dev`: visit `/account` while signed out → redirects to `/`. Sign in, click **Account** → shows name/email + a CrackLoop card. Reload on `/account` while signed in → stays.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: protected account page with registry app cards"
```

---

### Task 6: Legal pages, Vercel deploy config, README

Ensure the static legal pages are served, add Vercel config, and document the new setup.

**Files:**
- Verify present: `public/terms.html`, `public/privacy.html`, `public/favicon.svg`, `public/apple-touch-icon.png`, `public/og.png` (already in `public/` — Next serves them at root)
- Create: `vercel.json`, `docs/DEPLOY.md`
- Modify: `README.md` (replace the Vite/GH-Pages stack section with the Next/Vercel setup; keep the marketing description)

**Interfaces:**
- Produces: a Vercel-deployable app; docs for env vars + deploy.

- [ ] **Step 1: Confirm legal + icon assets in `public/`**

Run: `ls public`
Expected: `terms.html privacy.html favicon.svg apple-touch-icon.png og.png 404.html`. (They already exist from the Vite site; Next serves `public/` at `/`.) Confirm `/terms.html` and `/privacy.html` open in `pnpm dev`.

- [ ] **Step 2: Create `vercel.json`**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "next build",
  "installCommand": "pnpm install"
}
```

- [ ] **Step 3: Create `docs/DEPLOY.md`**

Document: Vercel project connected to this repo, production branch is **`feat/unified-nextjs-portal`** for now (NOT `main` — `main` stays on GitHub Pages); required env vars = the `NEXT_PUBLIC_FIREBASE_*` set from `.env.local.example` (phase-2 will add `RAZORPAY_*` + `FIREBASE_SERVICE_ACCOUNT`); add the Vercel preview domain to Firebase Auth → Authorized domains.

- [ ] **Step 4: Update `README.md`**

Replace the "Stack" and "Run locally" sections: framework now **Next.js 14 (App Router) + React 18 + TypeScript**, hosted on **Vercel**; marketing 3D stack (Three/R3F/GSAP/Lenis) retained; new portal (auth/subscriptions/creator/admin) in progress on this branch; run with `pnpm dev` (port 3000). Keep the product/highlights prose. Note `main` + GitHub Pages remain the live marketing site until cutover.

- [ ] **Step 5: Full verification**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: all pass; routes `/`, `/account` built; static legal pages served.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: vercel config, deploy docs, README for Next.js rewrite"
```

---

## Self-Review

**Spec coverage (phase 1 scope):**
- Next.js scaffold (App Router/TS/Tailwind) → Task 1 ✓
- Marketing 3D port → Task 2 ✓
- Firebase Google auth → Task 3 ✓
- App registry (vendored) → Task 4 ✓
- Account page → Task 5 ✓
- Layout/nav → Tasks 1, 3 ✓
- Legal pages → Task 6 ✓
- Vercel deploy, standalone/no-backend → Task 6 ✓; no Firestore writes/Razorpay in any task ✓
- Fallbacks/reduced-motion/low-power preserved → Global Constraints + Task 2 step 3/7 ✓

Out of phase-1 scope (correctly deferred to later plans): Razorpay, entitlement reads/writes, creator/admin portals, Firestore data.

**Placeholder scan:** The two intentional UI placeholders ("scaffold OK" page in Task 1, "No active subscription" in Task 5) are replaced by later tasks/phases and are called out as such — not plan placeholders. No TBD/TODO/"handle edge cases" steps.

**Type consistency:** `useAuth` shape (`user/loading/signIn/signOutUser`) consistent across Tasks 3 and 5; `AppRegistryEntry`/`getApp`/`listApps` consistent across Tasks 4 and 5; `firebase.ts` exports (`auth`, `db`) match usage.
