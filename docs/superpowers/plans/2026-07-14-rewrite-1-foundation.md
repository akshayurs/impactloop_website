# Rewrite Plan 1/4 — Foundation + Public Site

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Greenfield Next.js 15 site — theme system, UI primitives, all public pages (home, app detail, pricing display, legal), Google auth, account shell. Fast, mobile-first, light+dark.

**Architecture:** Server-first App Router. Marketing pages are static server components; client JS only in interactive islands (theme toggle, mobile menu, auth). Plans render from a static config behind a `getPlans()` interface that Plan 2 swaps to Firestore. No 3D, no animation libraries.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind v4, next-themes, Firebase JS SDK v11 (auth only in this plan), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-14-website-rewrite-design.md`

## Global Constraints

- Greenfield: old `src/` is deleted in Task 1; do not import from or reference old code
- Next.js `^15`, React `^19`, Tailwind `^4` — exact majors, no downgrades
- No `three`, `gsap`, `lenis`, `@react-three/*`, `postprocessing` anywhere
- All amounts in integer paise; display via `formatINR(paise)` only
- Brand accent: violet `#7C5CFF`; fonts Inter (body) + Space Grotesk (display) via `next/font/google`
- Public pages must be server components (no `'use client'` at page level)
- Every interactive element keyboard-accessible; visible focus states; WCAG AA contrast
- CrackLoop Play Store URL: `https://play.google.com/store/apps/details?id=com.impactloop.crackloop`
- Conventional Commits; commit at end of every task

## File Structure

```
src/
  app/
    layout.tsx                 # root: fonts, ThemeProvider, Nav, Footer
    page.tsx                   # home (static)
    apps/[appId]/page.tsx      # app detail (SSG)
    pricing/page.tsx           # plans display (static for now)
    terms/page.tsx  privacy/page.tsx
    account/page.tsx           # auth-gated shell
    globals.css                # tailwind v4 + theme tokens
  components/
    ui/button.tsx card.tsx badge.tsx input.tsx modal.tsx table.tsx
    nav.tsx footer.tsx theme-toggle.tsx auth-button.tsx
  lib/
    firebase/client.ts         # lazy firebase app+auth (client only)
    auth-context.tsx           # AuthProvider, useAuth
    format.ts                  # formatINR
  config/
    apps.ts                    # app registry (multi-app)
    plans.ts                   # Plan type + static getPlans()
```

---

### Task 1: Clean slate + Next 15 scaffold + test harness

**Files:**
- Delete: entire old `src/`, `public/404.html`, `public/.nojekyll`, `public/terms.html`, `public/privacy.html`, `dist/`, `next.config.mjs`, `tailwind.config.js`, `postcss.config.js`
- Create: `package.json` (rewrite), `next.config.ts`, `postcss.config.mjs`, `tsconfig.json` (keep, trim), `vitest.config.ts`, `vitest.setup.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/lib/format.ts`, `src/lib/format.test.ts`

**Interfaces:**
- Produces: `formatINR(paise: number): string` — `formatINR(9900)` → `"₹99"`, `formatINR(9950)` → `"₹99.50"`. Used by pricing + all later plans.

- [ ] **Step 1: New branch + delete old code**

```bash
git checkout -b feat/rewrite-v3
git rm -r src public/404.html public/.nojekyll public/terms.html public/privacy.html next.config.mjs tailwind.config.js postcss.config.js
rm -rf dist tsconfig.tsbuildinfo
```

- [ ] **Step 2: Rewrite package.json**

```json
{
  "name": "impact-loop-website",
  "private": true,
  "version": "3.0.0",
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "firebase": "^11.1.0",
    "next": "^15.1.0",
    "next-themes": "^0.4.4",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "jsdom": "^25.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

Run: `pnpm install`

- [ ] **Step 3: Config files**

`next.config.ts`:
```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
}

export default nextConfig
```

`postcss.config.mjs`:
```js
export default { plugins: { '@tailwindcss/postcss': {} } }
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  esbuild: { jsx: 'automatic' },
})
```

`vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```

Ensure `tsconfig.json` has `"paths": { "@/*": ["./src/*"] }`, `"jsx": "preserve"`, `"moduleResolution": "bundler"` (keep existing Next-generated values otherwise).

- [ ] **Step 4: Minimal app shell**

`src/app/globals.css` (tokens come in Task 2 — minimal now):
```css
@import 'tailwindcss';
```

`src/app/layout.tsx`:
```tsx
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
```

`src/app/page.tsx`:
```tsx
export default function HomePage() {
  return <main className="p-8">Impact Loop</main>
}
```

- [ ] **Step 5: Write failing test for formatINR**

`src/lib/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { formatINR } from './format'

describe('formatINR', () => {
  it('formats whole rupees without decimals', () => {
    expect(formatINR(9900)).toBe('₹99')
    expect(formatINR(0)).toBe('₹0')
    expect(formatINR(129900)).toBe('₹1,299')
  })
  it('formats fractional rupees with two decimals', () => {
    expect(formatINR(9950)).toBe('₹99.50')
  })
  it('throws on non-integer or negative paise', () => {
    expect(() => formatINR(99.5)).toThrow()
    expect(() => formatINR(-1)).toThrow()
  })
})
```

Run: `pnpm test` — Expected: FAIL, `format.ts` missing.

- [ ] **Step 6: Implement formatINR**

`src/lib/format.ts`:
```ts
export function formatINR(paise: number): string {
  if (!Number.isInteger(paise) || paise < 0) {
    throw new Error(`invalid paise amount: ${paise}`)
  }
  const rupees = paise / 100
  const hasFraction = paise % 100 !== 0
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(rupees)
}
```

Run: `pnpm test` — Expected: PASS. Note: `Intl` for `en-IN` renders `₹99`; if the runtime emits a space (`₹ 99`), normalize in the function with `.replace(/ | /g, '')` and keep tests as written.

- [ ] **Step 7: Verify dev server + typecheck**

Run: `pnpm typecheck` — Expected: clean. Run `pnpm build` — Expected: compiles, `/` static.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat!: greenfield Next 15 scaffold, drop legacy site"
```

---

### Task 2: Theme tokens, fonts, dark mode toggle

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`
- Create: `src/components/theme-provider.tsx`, `src/components/theme-toggle.tsx`, `src/components/theme-toggle.test.tsx`

**Interfaces:**
- Produces: CSS token classes used everywhere: `bg-bg text-fg`, `bg-card`, `border-line`, `text-muted`, `bg-accent text-accent-fg`. `<ThemeToggle />` client component.

- [ ] **Step 1: Theme tokens in globals.css**

```css
@import 'tailwindcss';

@custom-variant dark (&:where(.dark, .dark *));

:root {
  --bg: #fafafa;
  --fg: #111114;
  --muted: #5b5b66;
  --card: #ffffff;
  --line: #e5e5ea;
  --accent: #7c5cff;
  --accent-fg: #ffffff;
}

.dark {
  --bg: #0b0b0f;
  --fg: #f2f2f5;
  --muted: #9b9ba6;
  --card: #15151b;
  --line: #26262e;
  --accent: #8f75ff;
  --accent-fg: #0b0b0f;
}

@theme inline {
  --color-bg: var(--bg);
  --color-fg: var(--fg);
  --color-muted: var(--muted);
  --color-card: var(--card);
  --color-line: var(--line);
  --color-accent: var(--accent);
  --color-accent-fg: var(--accent-fg);
  --font-sans: var(--font-inter);
  --font-display: var(--font-space-grotesk);
}

body {
  background: var(--bg);
  color: var(--fg);
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

- [ ] **Step 2: ThemeProvider wrapper**

`src/components/theme-provider.tsx`:
```tsx
'use client'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  )
}
```

- [ ] **Step 3: Failing test for ThemeToggle**

`src/components/theme-toggle.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ThemeProvider } from './theme-provider'
import { ThemeToggle } from './theme-toggle'

describe('ThemeToggle', () => {
  it('renders an accessible toggle button', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    )
    expect(screen.getByRole('button', { name: /theme/i })).toBeInTheDocument()
  })
})
```

Run: `pnpm test` — Expected: FAIL.

- [ ] **Step 4: Implement ThemeToggle**

`src/components/theme-toggle.tsx`:
```tsx
'use client'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === 'dark'
  return (
    <button
      type="button"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="rounded-full border border-line p-2 text-fg hover:bg-card"
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  )
}
```

Run: `pnpm test` — Expected: PASS.

- [ ] **Step 5: Fonts + provider in layout**

`src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' })

export const metadata: Metadata = {
  title: { default: 'Impact Loop', template: '%s — Impact Loop' },
  description: 'Apps that build habits that stick.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 6: Verify** — `pnpm test && pnpm typecheck && pnpm build` all pass.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat: theme tokens, fonts, dark mode toggle"`

---

### Task 3: UI primitives — Button, Card, Badge, Input

**Files:**
- Create: `src/components/ui/button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`, `src/components/ui/ui.test.tsx`

**Interfaces:**
- Produces:
  - `Button({ variant?: 'primary'|'outline'|'ghost', size?: 'sm'|'md'|'lg', asChild-less; renders <button> or <a> via href prop })`
  - `Card({ children, className? })`, `Badge({ children, tone?: 'default'|'success'|'warn'|'danger' })`
  - `Input(props: React.InputHTMLAttributes & { label: string, error?: string })` — label always required (a11y)

- [ ] **Step 1: Failing tests**

`src/components/ui/ui.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge } from './badge'
import { Button } from './button'
import { Card } from './card'
import { Input } from './input'

describe('Button', () => {
  it('renders a button by default', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })
  it('renders an anchor when href given', () => {
    render(<Button href="/pricing">Pricing</Button>)
    expect(screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/pricing')
  })
})

describe('Input', () => {
  it('associates label and shows error with role=alert', () => {
    render(<Input label="Promo code" error="Invalid code" />)
    expect(screen.getByLabelText('Promo code')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid code')
  })
})

describe('Card & Badge', () => {
  it('render children', () => {
    render(
      <Card>
        <Badge tone="success">Active</Badge>
      </Card>,
    )
    expect(screen.getByText('Active')).toBeInTheDocument()
  })
})
```

Run: `pnpm test` — Expected: FAIL.

- [ ] **Step 2: Implement**

`src/components/ui/button.tsx`:
```tsx
import Link from 'next/link'

type Variant = 'primary' | 'outline' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center rounded-full font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none'
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:opacity-90',
  outline: 'border border-line text-fg hover:bg-card',
  ghost: 'text-fg hover:bg-card',
}
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-7 text-base',
}

type Props = {
  variant?: Variant
  size?: Size
  href?: string
  className?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>

export function Button({ variant = 'primary', size = 'md', href, className = '', ...rest }: Props) {
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`
  if (href) {
    return (
      <Link href={href} className={cls}>
        {rest.children}
      </Link>
    )
  }
  return <button type="button" className={cls} {...rest} />
}
```

`src/components/ui/card.tsx`:
```tsx
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-card p-6 ${className}`}>{children}</div>
}
```

`src/components/ui/badge.tsx`:
```tsx
type Tone = 'default' | 'success' | 'warn' | 'danger'
const tones: Record<Tone, string> = {
  default: 'bg-accent/10 text-accent',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warn: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  danger: 'bg-red-500/10 text-red-600 dark:text-red-400',
}
export function Badge({ children, tone = 'default' }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}
```

`src/components/ui/input.tsx`:
```tsx
'use client'
import { useId } from 'react'

type Props = { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>

export function Input({ label, error, className = '', ...rest }: Props) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        className={`h-10 rounded-lg border border-line bg-card px-3 text-sm text-fg placeholder:text-muted ${className}`}
        {...rest}
      />
      {error ? (
        <p role="alert" className="text-xs text-red-500">
          {error}
        </p>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 3: Verify** — `pnpm test` PASS, `pnpm typecheck` clean.
- [ ] **Step 4: Commit** — `git commit -am "feat: ui primitives (button, card, badge, input)"`

---

### Task 4: UI primitives — Modal (confirm dialog) + Table

**Files:**
- Create: `src/components/ui/modal.tsx`, `src/components/ui/table.tsx`, `src/components/ui/modal.test.tsx`

**Interfaces:**
- Produces: `ConfirmModal({ open, title, body, confirmLabel, onConfirm, onClose, destructive? })` — used by cancel-subscription and all admin destructive actions. `Table({ head: string[], children })` — semantic table, horizontal scroll wrapper on mobile.

- [ ] **Step 1: Failing test**

`src/components/ui/modal.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmModal } from './modal'

describe('ConfirmModal', () => {
  it('renders nothing when closed', () => {
    render(
      <ConfirmModal open={false} title="Cancel plan?" body="x" confirmLabel="Cancel plan" onConfirm={() => {}} onClose={() => {}} />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('fires onConfirm and onClose', () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(
      <ConfirmModal open title="Cancel plan?" body="Are you sure" confirmLabel="Yes, cancel" onConfirm={onConfirm} onClose={onClose} destructive />,
    )
    expect(screen.getByRole('dialog', { name: 'Cancel plan?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel' }))
    expect(onConfirm).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    expect(onClose).toHaveBeenCalled()
  })
})
```

Run: `pnpm test` — Expected: FAIL.

- [ ] **Step 2: Implement**

`src/components/ui/modal.tsx`:
```tsx
'use client'
import { useEffect } from 'react'
import { Button } from './button'

type Props = {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
  destructive?: boolean
}

export function ConfirmModal({ open, title, body, confirmLabel, onConfirm, onClose, destructive }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative w-full max-w-sm rounded-2xl border border-line bg-card p-6">
        <h2 className="font-display text-lg font-semibold text-fg">{title}</h2>
        <p className="mt-2 text-sm text-muted">{body}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Keep
          </Button>
          <Button
            onClick={onConfirm}
            className={destructive ? 'bg-red-600 text-white hover:opacity-90' : ''}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

`src/components/ui/table.tsx`:
```tsx
export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-line bg-card text-muted">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Verify** — `pnpm test` PASS.
- [ ] **Step 4: Commit** — `git commit -am "feat: confirm modal and table primitives"`

---

### Task 5: App registry + plans config

**Files:**
- Create: `src/config/apps.ts`, `src/config/apps.test.ts`, `src/config/plans.ts`, `src/config/plans.test.ts`

**Interfaces:**
- Produces:
  - `type AppInfo = { id: string; name: string; tagline: string; description: string; features: string[]; playStoreUrl: string; status: 'live' | 'coming-soon' }`
  - `APPS: AppInfo[]`, `getApp(id: string): AppInfo | undefined`
  - `type Plan = { id: string; appId: string; tier: 'pro' | 'ai'; durationMonths: 1 | 3 | 6 | 12 | null; lifetime: boolean; pricePaise: number; playStorePricePaise: number | null; active: boolean; sort: number }`
  - `getPlans(appId: string): Promise<Plan[]>` — async on purpose; Plan 2 swaps the body to Firestore without changing callers.

- [ ] **Step 1: Failing tests**

`src/config/apps.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { APPS, getApp } from './apps'

describe('app registry', () => {
  it('contains crackloop as a live app with play store url', () => {
    const app = getApp('crackloop')
    expect(app).toBeDefined()
    expect(app!.status).toBe('live')
    expect(app!.playStoreUrl).toBe('https://play.google.com/store/apps/details?id=com.impactloop.crackloop')
  })
  it('returns undefined for unknown app', () => {
    expect(getApp('nope')).toBeUndefined()
  })
  it('every app has non-empty features', () => {
    for (const app of APPS) expect(app.features.length).toBeGreaterThan(0)
  })
})
```

`src/config/plans.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { getPlans } from './plans'

describe('getPlans', () => {
  it('returns active crackloop plans sorted by sort key', async () => {
    const plans = await getPlans('crackloop')
    expect(plans.length).toBeGreaterThan(0)
    expect(plans.every((p) => p.active && p.appId === 'crackloop')).toBe(true)
    expect(plans.map((p) => p.sort)).toEqual([...plans.map((p) => p.sort)].sort((a, b) => a - b))
  })
  it('lifetime plans have null duration and integer paise price', async () => {
    const plans = await getPlans('crackloop')
    const lifetime = plans.filter((p) => p.lifetime)
    for (const p of lifetime) {
      expect(p.durationMonths).toBeNull()
      expect(Number.isInteger(p.pricePaise)).toBe(true)
    }
  })
  it('returns empty for unknown app', async () => {
    expect(await getPlans('nope')).toEqual([])
  })
})
```

Run: `pnpm test` — Expected: FAIL.

- [ ] **Step 2: Implement**

`src/config/apps.ts`:
```ts
export type AppInfo = {
  id: string
  name: string
  tagline: string
  description: string
  features: string[]
  playStoreUrl: string
  status: 'live' | 'coming-soon'
}

export const APPS: AppInfo[] = [
  {
    id: 'crackloop',
    name: 'CrackLoop',
    tagline: 'Crack your exams with focused daily loops.',
    description:
      'CrackLoop turns exam preparation into short, repeatable daily loops — practice, review, and track streaks so studying becomes a habit instead of a chore.',
    features: [
      'Daily practice loops with streak tracking',
      'Smart review of weak topics',
      'Progress analytics across subjects',
      'Distraction-free study sessions',
    ],
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.impactloop.crackloop',
    status: 'live',
  },
]

export function getApp(id: string): AppInfo | undefined {
  return APPS.find((a) => a.id === id)
}
```

`src/config/plans.ts`:
```ts
export type Plan = {
  id: string
  appId: string
  tier: 'pro' | 'ai'
  durationMonths: 1 | 3 | 6 | 12 | null
  lifetime: boolean
  pricePaise: number
  playStorePricePaise: number | null
  active: boolean
  sort: number
}

const STATIC_PLANS: Plan[] = [
  { id: 'crackloop-pro-1m', appId: 'crackloop', tier: 'pro', durationMonths: 1, lifetime: false, pricePaise: 7900, playStorePricePaise: 9900, active: true, sort: 1 },
  { id: 'crackloop-pro-12m', appId: 'crackloop', tier: 'pro', durationMonths: 12, lifetime: false, pricePaise: 79900, playStorePricePaise: 99900, active: true, sort: 2 },
  { id: 'crackloop-pro-life', appId: 'crackloop', tier: 'pro', durationMonths: null, lifetime: true, pricePaise: 199900, playStorePricePaise: null, active: true, sort: 3 },
  { id: 'crackloop-ai-1m', appId: 'crackloop', tier: 'ai', durationMonths: 1, lifetime: false, pricePaise: 15900, playStorePricePaise: 19900, active: true, sort: 4 },
]

// Static source for Plan 1; Plan 2 replaces the body with a Firestore query.
export async function getPlans(appId: string): Promise<Plan[]> {
  return STATIC_PLANS.filter((p) => p.appId === appId && p.active).sort((a, b) => a.sort - b.sort)
}
```

(Prices are placeholders — admin sets real prices in Plan 3's dashboard.)

- [ ] **Step 3: Verify** — `pnpm test` PASS.
- [ ] **Step 4: Commit** — `git commit -am "feat: multi-app registry and plans config interface"`

---

### Task 6: Nav + Footer + shell layout

**Files:**
- Create: `src/components/nav.tsx`, `src/components/footer.tsx`, `src/components/nav.test.tsx`, `src/components/logo.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: `<Nav />` (client: mobile menu state; renders ThemeToggle + AuthButton slot — AuthButton added Task 10, use placeholder link `/account` until then), `<Footer />` (server). Layout gains skip-link + `<main id="main">`.

- [ ] **Step 1: Failing test**

`src/components/nav.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ThemeProvider } from './theme-provider'
import { Nav } from './nav'

describe('Nav', () => {
  it('has links to apps and pricing', () => {
    render(
      <ThemeProvider>
        <Nav />
      </ThemeProvider>,
    )
    expect(screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/pricing')
  })
  it('mobile menu is hidden until toggled and uses aria-expanded', () => {
    render(
      <ThemeProvider>
        <Nav />
      </ThemeProvider>,
    )
    const toggle = screen.getByRole('button', { name: /menu/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })
})
```

Run: `pnpm test` — Expected: FAIL.

- [ ] **Step 2: Implement Logo, Nav, Footer**

`src/components/logo.tsx`:
```tsx
export function Logo() {
  return (
    <span className="flex items-center gap-2 font-display text-lg font-bold text-fg">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="var(--accent)" strokeWidth="3" />
        <circle cx="12" cy="3" r="3" fill="var(--accent)" />
      </svg>
      Impact Loop
    </span>
  )
}
```

`src/components/nav.tsx`:
```tsx
'use client'
import Link from 'next/link'
import { useState } from 'react'
import { Logo } from './logo'
import { ThemeToggle } from './theme-toggle'

const LINKS = [
  { href: '/apps/crackloop', label: 'CrackLoop' },
  { href: '/pricing', label: 'Pricing' },
]

export function Nav() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6" aria-label="Main">
        <Link href="/" aria-label="Impact Loop home">
          <Logo />
        </Link>
        <div className="hidden items-center gap-6 md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-muted hover:text-fg">
              {l.label}
            </Link>
          ))}
          <Link href="/account" className="text-sm text-muted hover:text-fg">
            Account
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-line p-2"
          >
            <span aria-hidden>{open ? '✕' : '☰'}</span>
          </button>
        </div>
      </nav>
      {open ? (
        <div className="border-t border-line px-4 py-3 md:hidden">
          {[...LINKS, { href: '/account', label: 'Account' }].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-2 py-3 text-fg hover:bg-card"
            >
              {l.label}
            </Link>
          ))}
        </div>
      ) : null}
    </header>
  )
}
```

Note: menu content is unmounted when closed (`open ? ... : null`) — closed menu can never trap keyboard focus.

`src/components/footer.tsx`:
```tsx
import Link from 'next/link'
import { APPS } from '@/config/apps'
import { Logo } from './logo'

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-muted">Apps that build habits that stick.</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-fg">Apps</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {APPS.map((a) => (
              <li key={a.id}>
                <Link href={`/apps/${a.id}`} className="hover:text-fg">
                  {a.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-fg">Legal</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>
              <Link href="/terms" className="hover:text-fg">Terms</Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-fg">Privacy</Link>
            </li>
          </ul>
        </div>
      </div>
      <p className="border-t border-line py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} Impact Loop
      </p>
    </footer>
  )
}
```

- [ ] **Step 3: Wire into layout with skip link**

In `src/app/layout.tsx` body:
```tsx
<ThemeProvider>
  <a
    href="#main"
    className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-fg"
  >
    Skip to content
  </a>
  <Nav />
  <main id="main" className="min-h-[60vh]">{children}</main>
  <Footer />
</ThemeProvider>
```

(Import `Nav`, `Footer`.)

- [ ] **Step 4: Verify** — `pnpm test && pnpm typecheck && pnpm build` PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat: nav, footer, shell layout with skip link"`

---

### Task 7: Home page

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `APPS` from `@/config/apps`, `Button`, `Card`, `Badge`.
- Server component, zero client JS. No fake stats anywhere.

- [ ] **Step 1: Implement**

`src/app/page.tsx`:
```tsx
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { APPS } from '@/config/apps'

export default function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 sm:py-28">
        <h1 className="mx-auto max-w-2xl font-display text-4xl font-bold tracking-tight text-fg sm:text-6xl">
          Apps that build habits that stick.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted">
          Impact Loop makes focused mobile apps for learning and self-improvement — starting with
          CrackLoop for exam prep.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button href="/apps/crackloop" size="lg">Explore CrackLoop</Button>
          <Button href="/pricing" size="lg" variant="outline">See pricing</Button>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6" aria-labelledby="apps-heading">
        <h2 id="apps-heading" className="font-display text-2xl font-semibold text-fg">Our apps</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {APPS.map((app) => (
            <Card key={app.id}>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold text-fg">{app.name}</h3>
                <Badge tone={app.status === 'live' ? 'success' : 'default'}>
                  {app.status === 'live' ? 'Live on Play Store' : 'Coming soon'}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted">{app.tagline}</p>
              <div className="mt-5">
                <Button href={`/apps/${app.id}`} variant="outline" size="sm">Learn more</Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-card/50">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-2xl font-semibold text-fg">Subscribe on the web, pay less</h2>
          <p className="mt-3 max-w-2xl text-muted">
            Web subscriptions skip app-store fees, so plans here cost less than the same plans on
            Google Play. One account, works everywhere.
          </p>
          <div className="mt-6">
            <Button href="/pricing">View plans</Button>
          </div>
        </div>
      </section>
    </>
  )
}
```

- [ ] **Step 2: Verify** — `pnpm build` PASS; `/` listed as static (○) in build output.
- [ ] **Step 3: Commit** — `git commit -am "feat: home page"`

---

### Task 8: App detail page

**Files:**
- Create: `src/app/apps/[appId]/page.tsx`

**Interfaces:**
- Consumes: `getApp`, `APPS`. SSG via `generateStaticParams`; unknown id → `notFound()`. Screenshot placeholders: gray boxes with app name — real images swapped later by owner.

- [ ] **Step 1: Implement**

`src/app/apps/[appId]/page.tsx`:
```tsx
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { APPS, getApp } from '@/config/apps'

export function generateStaticParams() {
  return APPS.map((a) => ({ appId: a.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ appId: string }> }): Promise<Metadata> {
  const { appId } = await params
  const app = getApp(appId)
  return app ? { title: app.name, description: app.tagline } : {}
}

export default async function AppPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params
  const app = getApp(appId)
  if (!app) notFound()

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl font-bold text-fg">{app.name}</h1>
        <Badge tone={app.status === 'live' ? 'success' : 'default'}>
          {app.status === 'live' ? 'Live on Play Store' : 'Coming soon'}
        </Badge>
      </div>
      <p className="mt-3 max-w-2xl text-lg text-muted">{app.description}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button href={app.playStoreUrl} size="lg">Get it on Google Play</Button>
        <Button href="/pricing" size="lg" variant="outline">Web pricing</Button>
      </div>

      <section className="mt-14" aria-label="Screenshots">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex aspect-[9/19] items-center justify-center rounded-2xl border border-line bg-card text-xs text-muted"
            >
              {app.name} screenshot {i}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14" aria-labelledby="features-heading">
        <h2 id="features-heading" className="font-display text-2xl font-semibold text-fg">Features</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {app.features.map((f) => (
            <Card key={f} className="p-4">
              <p className="text-sm text-fg">{f}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Verify** — `pnpm build`: `/apps/crackloop` prerendered (●/SSG). Visiting `/apps/unknown` → 404.
- [ ] **Step 3: Commit** — `git commit -am "feat: app detail page with SSG"`

---

### Task 9: Pricing page (display only)

**Files:**
- Create: `src/app/pricing/page.tsx`, `src/components/plan-card.tsx`, `src/components/plan-card.test.tsx`

**Interfaces:**
- Consumes: `getPlans`, `formatINR`, `Card`, `Badge`, `Button`.
- Produces: `<PlanCard plan={Plan} />` — server component. Subscribe button is `href="/account"` placeholder; Plan 2 replaces with checkout island. Strikethrough Play Store price when `playStorePricePaise` present, with `aria-label` describing the saving.
- `durationLabel(plan: Plan): string` exported from `plan-card.tsx` — `'1 month' | '3 months' | ... | 'Lifetime'`.

- [ ] **Step 1: Failing test**

`src/components/plan-card.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Plan } from '@/config/plans'
import { PlanCard, durationLabel } from './plan-card'

const plan: Plan = {
  id: 'p1', appId: 'crackloop', tier: 'pro', durationMonths: 12, lifetime: false,
  pricePaise: 79900, playStorePricePaise: 99900, active: true, sort: 1,
}

describe('durationLabel', () => {
  it('labels durations and lifetime', () => {
    expect(durationLabel(plan)).toBe('12 months')
    expect(durationLabel({ ...plan, durationMonths: 1 })).toBe('1 month')
    expect(durationLabel({ ...plan, durationMonths: null, lifetime: true })).toBe('Lifetime')
  })
})

describe('PlanCard', () => {
  it('shows web price and struck-through play store price', () => {
    render(<PlanCard plan={plan} />)
    expect(screen.getByText('₹799')).toBeInTheDocument()
    const struck = screen.getByText('₹999')
    expect(struck.tagName).toBe('S')
  })
})
```

Run: `pnpm test` — Expected: FAIL.

- [ ] **Step 2: Implement**

`src/components/plan-card.tsx`:
```tsx
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Plan } from '@/config/plans'
import { formatINR } from '@/lib/format'

export function durationLabel(plan: Plan): string {
  if (plan.lifetime) return 'Lifetime'
  return plan.durationMonths === 1 ? '1 month' : `${plan.durationMonths} months`
}

export function PlanCard({ plan }: { plan: Plan }) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold uppercase text-fg">{plan.tier}</h3>
        <Badge>{durationLabel(plan)}</Badge>
      </div>
      <p className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-fg">{formatINR(plan.pricePaise)}</span>
        {plan.playStorePricePaise ? (
          <s className="text-sm text-muted" aria-label={`Play Store price ${formatINR(plan.playStorePricePaise)}`}>
            {formatINR(plan.playStorePricePaise)}
          </s>
        ) : null}
      </p>
      {plan.playStorePricePaise ? (
        <p className="mt-1 text-xs text-muted">Cheaper than Google Play — no store fees.</p>
      ) : null}
      <div className="mt-6">
        <Button href="/account" className="w-full">
          {plan.lifetime ? 'Buy once' : 'Subscribe'}
        </Button>
      </div>
    </Card>
  )
}
```

`src/app/pricing/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { PlanCard } from '@/components/plan-card'
import { APPS } from '@/config/apps'
import { getPlans } from '@/config/plans'

export const metadata: Metadata = { title: 'Pricing' }

export default async function PricingPage() {
  const sections = await Promise.all(
    APPS.filter((a) => a.status === 'live').map(async (app) => ({
      app,
      plans: await getPlans(app.id),
    })),
  )

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-4xl font-bold text-fg">Pricing</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Subscribe on the web and pay less than on Google Play. Cancel anytime from your account.
      </p>
      {sections.map(({ app, plans }) => (
        <section key={app.id} className="mt-12" aria-labelledby={`pricing-${app.id}`}>
          <h2 id={`pricing-${app.id}`} className="font-display text-2xl font-semibold text-fg">
            {app.name}
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((p) => (
              <PlanCard key={p.id} plan={p} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Verify** — `pnpm test && pnpm build` PASS.
- [ ] **Step 4: Commit** — `git commit -am "feat: pricing page with web-vs-play price display"`

---

### Task 10: Firebase auth + account shell

**Files:**
- Create: `src/lib/firebase/client.ts`, `src/lib/auth-context.tsx`, `src/components/auth-button.tsx`, `src/app/account/page.tsx`, `src/app/account/account-view.tsx`, `.env.local.example` (rewrite)
- Modify: `src/app/layout.tsx` (wrap in AuthProvider), `src/components/nav.tsx` (Account link → AuthButton)

**Interfaces:**
- Produces:
  - `getFirebaseAuth(): Auth` — lazy init, throws if called server-side
  - `useAuth(): { user: User | null; loading: boolean; signIn(): Promise<void>; signOut(): Promise<void> }`
  - `<AuthButton />` — skeleton while loading (never `null` — no layout shift)
- AuthProvider mounts only auth (no Firestore) — keeps marketing JS small; Firestore arrives with Plan 2 server-side.

- [ ] **Step 1: Firebase client**

`src/lib/firebase/client.ts`:
```ts
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

function app(): FirebaseApp {
  if (typeof window === 'undefined') throw new Error('firebase client used on server')
  const existing = getApps()[0]
  if (existing) return existing
  return initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  })
}

export function getFirebaseAuth(): Auth {
  return getAuth(app())
}
```

`.env.local.example`:
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

- [ ] **Step 2: Auth context**

`src/lib/auth-context.tsx`:
```tsx
'use client'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { createContext, useContext, useEffect, useState } from 'react'
import { getFirebaseAuth } from './firebase/client'

type AuthState = {
  user: User | null
  loading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(getFirebaseAuth(), (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  const signIn = async () => {
    await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider())
  }
  const signOut = async () => {
    await fbSignOut(getFirebaseAuth())
  }

  return <AuthContext.Provider value={{ user, loading, signIn, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
```

- [ ] **Step 3: AuthButton with skeleton**

`src/components/auth-button.tsx`:
```tsx
'use client'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { Button } from './ui/button'

export function AuthButton() {
  const { user, loading, signIn } = useAuth()
  if (loading) return <div className="h-8 w-20 animate-pulse rounded-full bg-card" aria-hidden />
  if (!user) {
    return (
      <Button size="sm" onClick={() => void signIn()}>
        Sign in
      </Button>
    )
  }
  return (
    <Link href="/account" className="text-sm text-muted hover:text-fg">
      Account
    </Link>
  )
}
```

In `nav.tsx`: replace both `/account` links with `<AuthButton />` (desktop row and mobile panel). In `layout.tsx`: wrap `<Nav />…<Footer />` inside `<AuthProvider>` (inside ThemeProvider).

- [ ] **Step 4: Account page**

`src/app/account/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { AccountView } from './account-view'

export const metadata: Metadata = { title: 'Account' }

export default function AccountPage() {
  return <AccountView />
}
```

`src/app/account/account-view.tsx`:
```tsx
'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/lib/auth-context'

export function AccountView() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/')
  }, [loading, user, router])

  if (loading || !user) {
    return <p className="px-4 py-16 text-center text-muted">Loading…</p>
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-fg">Account</h1>
      <Card className="mt-8">
        <p className="text-sm text-muted">Signed in as</p>
        <p className="mt-1 font-medium text-fg">{user.displayName ?? user.email}</p>
        <p className="text-sm text-muted">{user.email}</p>
        <div className="mt-6">
          <Button variant="outline" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </Card>
      <Card className="mt-6">
        <h2 className="font-display text-lg font-semibold text-fg">Subscriptions</h2>
        <p className="mt-2 text-sm text-muted">
          Your subscriptions will appear here once checkout goes live.
        </p>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5: Verify** — `pnpm test && pnpm typecheck && pnpm build` PASS. Manual: `pnpm dev` with real `.env.local`, sign in with Google, `/account` shows profile, sign out redirects home.
- [ ] **Step 6: Commit** — `git commit -am "feat: google auth, auth button, account shell"`

---

### Task 11: Legal pages + SEO + cleanup

**Files:**
- Create: `src/app/terms/page.tsx`, `src/app/privacy/page.tsx`, `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/not-found.tsx`
- Modify: `src/app/layout.tsx` (metadataBase), `README.md` (rewrite intro/stack)

**Interfaces:**
- Site URL constant: `const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://impactloop.vercel.app'` in `src/config/site.ts`, consumed by sitemap/robots/layout.

- [ ] **Step 1: Site config + legal pages**

`src/config/site.ts`:
```ts
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://impactloop.vercel.app'
```

`src/app/terms/page.tsx` and `src/app/privacy/page.tsx`: port the text content out of the deleted `public/terms.html` / `public/privacy.html` (retrieve via `git show HEAD~N:public/terms.html` from the pre-deletion commit) into server components — headings as `<h1>/<h2>`, paragraphs as `<p className="mt-3 text-muted">`, wrapped in `<div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">`. `export const metadata = { title: 'Terms' }` / `'Privacy'`.

- [ ] **Step 2: SEO files**

`src/app/sitemap.ts`:
```ts
import type { MetadataRoute } from 'next'
import { APPS } from '@/config/apps'
import { SITE_URL } from '@/config/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/pricing', '/terms', '/privacy', ...APPS.map((a) => `/apps/${a.id}`)]
  return routes.map((r) => ({ url: `${SITE_URL}${r}`, changeFrequency: 'weekly' }))
}
```

`src/app/robots.ts`:
```ts
import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/config/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/account', '/admin', '/influencer', '/api'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
```

`src/app/not-found.tsx`:
```tsx
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
      <h1 className="font-display text-4xl font-bold text-fg">Page not found</h1>
      <p className="mt-3 text-muted">The page you’re looking for doesn’t exist.</p>
      <div className="mt-8">
        <Button href="/">Back home</Button>
      </div>
    </div>
  )
}
```

In `layout.tsx` metadata: add `metadataBase: new URL(SITE_URL)`, `openGraph: { siteName: 'Impact Loop', type: 'website' }`.

- [ ] **Step 3: README rewrite** — replace stack table + highlights with the new stack (Next 15, Tailwind 4, no 3D), keep run-locally commands, note spec/plan paths under `docs/superpowers/`.

- [ ] **Step 4: Verify all**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: all pass; build output shows `/`, `/pricing`, `/apps/crackloop`, `/terms`, `/privacy` as static; `/sitemap.xml`, `/robots.txt` present.

- [ ] **Step 5: Commit** — `git commit -am "feat: legal pages, sitemap, robots, 404, readme"`

---

### Task 12: Browser verification pass

**Files:** none (verification only)

- [ ] **Step 1:** `pnpm dev` with real `.env.local`; verify in preview browser: home renders instantly, theme toggle persists across reload, mobile viewport (375px) — nav hamburger works, pricing cards stack, no horizontal scroll on any page.
- [ ] **Step 2:** Dark + light: check contrast of muted text on both themes; console clean on all pages.
- [ ] **Step 3:** Auth flow live: sign in → account → sign out (needs Vercel/localhost in Firebase authorized domains).
- [ ] **Step 4:** Fix anything found (each fix = its own commit), then final commit if needed.

---

## Out of scope for Plan 1
- Checkout/Razorpay (Plan 2 — swaps `getPlans` to Firestore, replaces PlanCard button with checkout island)
- Admin dashboard (Plan 3), influencer system (Plan 4)
- Real screenshots (owner provides; placeholder boxes shipped)
