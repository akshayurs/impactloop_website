# Rewrite Plan 3/4 — Admin Dashboard + Roles + Free Trials

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Single-admin dashboard (overview metrics, user management with trial grants/revoke, plan CRUD, global settings, webhook log) gated by a Firebase custom claim, plus user-facing free-trial requests.

**Architecture:** Role = `admin: true` custom claim set by a one-time script on the owner's account. Every `/api/admin/*` route enforces the claim server-side via `requireAdmin`. Admin UI = client components under `/admin` calling those APIs with Bearer tokens (server data never trusted from client). Trials: admin-configurable via `settings/global`; users self-request → instant grant with `status:'trial'` entitlement that paid subscriptions can overwrite ('trial' is NOT in the live allowlist, so trial users can still buy).

**Tech Stack:** unchanged (Next 15 route handlers, firebase-admin, Vitest).

**Spec:** `docs/superpowers/specs/2026-07-14-website-rewrite-design.md` §2 (admin routes), §3 (settings/global)
**Builds on:** Plan 2 — `requireUser`/`UnauthorizedError`, `adminDb`, `grantsForTier`, `EntitlementDoc`, `writeEntitlement`, `getPlansFromDb`, `isLiveStatus`, Razorpay client, UI primitives (`Table`, `ConfirmModal`, `Badge`, `Input`, `Button`, `Card`).

## Global Constraints

- Exactly one admin; claim `{ admin: true }` set via `scripts/set-admin.mjs <email>` (run manually by owner)
- EVERY admin API route calls `requireAdmin(req)` first — 401 unauth, 403 non-admin; uid never from body
- Trial status string is `'trial'`; it must NOT be added to `ACTIVE_SUB_STATUSES` (trial must not block paid checkout; webhook grants overwrite trial via merge)
- Trials: once per user per app forever (`trialUsed: true` flag on the app doc survives entitlement overwrites)
- All amounts integer paise; display via `formatINR`
- Plan price changes: Razorpay plans are immutable → price edit = deactivate old plan doc + create new (the API enforces this; only `playStorePricePaise`, `sort`, `active` are mutable)
- Admin pages: client components (Bearer-token APIs), never server-render admin data; `/admin` stays in robots.txt disallow (already is)
- `pnpm build` green with no env vars; no firebase-admin in client bundles
- Conventional Commits; commit per task; vi.hoisted() for mock consts in vi.mock factories; never mockReset with rejected-promise mocks

## File Structure

```
scripts/set-admin.mjs               # one-time claim setter
src/lib/server/
  require-admin.ts                  # requireAdmin(req) -> {uid,email} | 401/403 errors
  settings.ts                       # getSettings()/updateSettings() with defaults
  trial.ts                          # trial eligibility + grant
  admin-data.ts                     # metrics, user list/detail, plan mutations, webhook log
src/app/api/
  trial/route.ts                    # POST: user self-request
  admin/metrics/route.ts            # GET
  admin/users/route.ts              # GET list (?q= filter)
  admin/users/[uid]/route.ts        # GET detail; POST actions {action: grant-trial|revoke|cancel-autorenew}
  admin/plans/route.ts              # GET all (incl. inactive); POST create
  admin/plans/[planId]/route.ts     # PATCH mutable fields
  admin/settings/route.ts           # GET; PUT
  admin/webhooks/route.ts           # GET recent events
src/app/admin/
  layout.tsx                        # admin shell: client gate + section nav
  page.tsx                          # overview (client AdminOverview)
  users/page.tsx  plans/page.tsx  settings/page.tsx  webhooks/page.tsx
src/components/admin/
  admin-gate.tsx                    # useAuth + role check via /api/admin/metrics probe
  admin-fetch.ts                    # authed fetch helper
  overview.tsx users.tsx plans.tsx settings.tsx webhooks.tsx
src/app/account/account-view.tsx    # + trial request button
```

---

### Task 1: requireAdmin + set-admin script

**Files:**
- Create: `src/lib/server/require-admin.ts`, `src/lib/server/require-admin.test.ts`, `scripts/set-admin.mjs`

**Interfaces:**
- Consumes: `adminAuth` from `./firebase-admin`.
- Produces: `requireAdmin(req: Request): Promise<{ uid: string; email: string | null }>` — verifies Bearer token AND `decoded.admin === true`; throws `UnauthorizedError` (reuse from verify-token) when unauthenticated, `ForbiddenError` (new, `status = 403`) when authenticated but not admin. Exports `ForbiddenError`.

- [ ] **Step 1: Failing tests**

`src/lib/server/require-admin.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'

const { verifyIdToken } = vi.hoisted(() => ({ verifyIdToken: vi.fn() }))
vi.mock('./firebase-admin', () => ({ adminAuth: () => ({ verifyIdToken }) }))

import { ForbiddenError, requireAdmin } from './require-admin'
import { UnauthorizedError } from './verify-token'

function req(auth?: string) {
  return new Request('http://x', auth ? { headers: { Authorization: auth } } : undefined)
}

describe('requireAdmin', () => {
  it('rejects missing token with UnauthorizedError', async () => {
    const err = await requireAdmin(req()).then(() => null, (e: unknown) => e)
    expect(err).toBeInstanceOf(UnauthorizedError)
  })

  it('rejects invalid token with UnauthorizedError', async () => {
    verifyIdToken.mockImplementation(() => Promise.reject(new Error('bad')))
    const err = await requireAdmin(req('Bearer t')).then(() => null, (e: unknown) => e)
    expect(err).toBeInstanceOf(UnauthorizedError)
  })

  it('rejects authenticated non-admin with ForbiddenError', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.c' })
    const err = await requireAdmin(req('Bearer t')).then(() => null, (e: unknown) => e)
    expect(err).toBeInstanceOf(ForbiddenError)
  })

  it('accepts admin claim', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.c', admin: true })
    await expect(requireAdmin(req('Bearer t'))).resolves.toEqual({ uid: 'u1', email: 'a@b.c' })
  })
})
```

Run — Expected: FAIL.

- [ ] **Step 2: Implement**

`src/lib/server/require-admin.ts`:
```ts
import { adminAuth } from './firebase-admin'
import { UnauthorizedError } from './verify-token'

export class ForbiddenError extends Error {
  status = 403
}

export async function requireAdmin(req: Request): Promise<{ uid: string; email: string | null }> {
  const header = req.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) throw new UnauthorizedError('missing bearer token')
  let decoded: { uid: string; email?: string; admin?: unknown }
  try {
    decoded = await adminAuth().verifyIdToken(header.slice('Bearer '.length))
  } catch {
    throw new UnauthorizedError('invalid token')
  }
  if (decoded.admin !== true) throw new ForbiddenError('admin only')
  return { uid: decoded.uid, email: decoded.email ?? null }
}
```

`scripts/set-admin.mjs`:
```js
// Usage: node --env-file=.env.local scripts/set-admin.mjs you@example.com
import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const email = process.argv[2]
if (!email) {
  console.error('usage: node --env-file=.env.local scripts/set-admin.mjs <email>')
  process.exit(1)
}
const app = initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) })
const auth = getAuth(app)
const user = await auth.getUserByEmail(email)
await auth.setCustomUserClaims(user.uid, { admin: true })
console.log(`admin claim set for ${email} (${user.uid}) — user must sign out/in to refresh token`)
```

- [ ] **Step 3: Verify** — `pnpm test && pnpm typecheck` clean; `pnpm build` green.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: admin role claim, requireAdmin guard, set-admin script"`

---

### Task 2: Settings store

**Files:**
- Create: `src/lib/server/settings.ts`, `src/lib/server/settings.test.ts`

**Interfaces:**
- Produces:
  - `type GlobalSettings = { freeTrialEnabled: boolean; trialDays: number; promoDefaultExpiryMonths: number }`
  - `DEFAULT_SETTINGS: GlobalSettings = { freeTrialEnabled: false, trialDays: 7, promoDefaultExpiryMonths: 3 }`
  - `getSettings(): Promise<GlobalSettings>` — reads `settings/global`, merges over defaults (missing doc/fields → defaults)
  - `updateSettings(patch: Partial<GlobalSettings>): Promise<GlobalSettings>` — validates (trialDays integer 1–365; promoDefaultExpiryMonths integer 1–24; unknown keys rejected with Error), merge-writes, returns merged result

- [ ] **Step 1: Failing tests**

`src/lib/server/settings.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { docGet, docSet } = vi.hoisted(() => ({ docGet: vi.fn(), docSet: vi.fn() }))
vi.mock('./firebase-admin', () => ({
  adminDb: () => ({ doc: () => ({ get: docGet, set: (d: unknown, o?: unknown) => docSet(d, o) }) }),
}))

import { DEFAULT_SETTINGS, getSettings, updateSettings } from './settings'

describe('settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    docGet.mockResolvedValue({ exists: false, data: () => undefined })
  })

  it('returns defaults when doc missing', async () => {
    await expect(getSettings()).resolves.toEqual(DEFAULT_SETTINGS)
  })

  it('merges stored fields over defaults', async () => {
    docGet.mockResolvedValue({ exists: true, data: () => ({ freeTrialEnabled: true }) })
    await expect(getSettings()).resolves.toEqual({ ...DEFAULT_SETTINGS, freeTrialEnabled: true })
  })

  it('updates valid patch with merge and returns merged', async () => {
    const res = await updateSettings({ freeTrialEnabled: true, trialDays: 30 })
    expect(docSet).toHaveBeenCalledWith({ freeTrialEnabled: true, trialDays: 30 }, { merge: true })
    expect(res).toEqual({ ...DEFAULT_SETTINGS, freeTrialEnabled: true, trialDays: 30 })
  })

  it('rejects invalid trialDays and unknown keys', async () => {
    await expect(updateSettings({ trialDays: 0 })).rejects.toThrow(/trialDays/)
    await expect(updateSettings({ trialDays: 1.5 })).rejects.toThrow(/trialDays/)
    await expect(updateSettings({ nope: 1 } as never)).rejects.toThrow(/unknown/)
    expect(docSet).not.toHaveBeenCalled()
  })
})
```

Run — Expected: FAIL.

- [ ] **Step 2: Implement**

`src/lib/server/settings.ts`:
```ts
import { adminDb } from './firebase-admin'

export type GlobalSettings = {
  freeTrialEnabled: boolean
  trialDays: number
  promoDefaultExpiryMonths: number
}

export const DEFAULT_SETTINGS: GlobalSettings = {
  freeTrialEnabled: false,
  trialDays: 7,
  promoDefaultExpiryMonths: 3,
}

export async function getSettings(): Promise<GlobalSettings> {
  const snap = await adminDb().doc('settings/global').get()
  const stored = snap.exists ? (snap.data() as Partial<GlobalSettings>) : {}
  return { ...DEFAULT_SETTINGS, ...stored }
}

export async function updateSettings(patch: Partial<GlobalSettings>): Promise<GlobalSettings> {
  for (const key of Object.keys(patch)) {
    if (!(key in DEFAULT_SETTINGS)) throw new Error(`unknown settings key: ${key}`)
  }
  if (patch.trialDays !== undefined && (!Number.isInteger(patch.trialDays) || patch.trialDays < 1 || patch.trialDays > 365)) {
    throw new Error('trialDays must be an integer between 1 and 365')
  }
  if (
    patch.promoDefaultExpiryMonths !== undefined &&
    (!Number.isInteger(patch.promoDefaultExpiryMonths) || patch.promoDefaultExpiryMonths < 1 || patch.promoDefaultExpiryMonths > 24)
  ) {
    throw new Error('promoDefaultExpiryMonths must be an integer between 1 and 24')
  }
  if (patch.freeTrialEnabled !== undefined && typeof patch.freeTrialEnabled !== 'boolean') {
    throw new Error('freeTrialEnabled must be boolean')
  }
  await adminDb().doc('settings/global').set(patch, { merge: true })
  const current = await getSettings()
  return current
}
```

- [ ] **Step 3: Verify** — tests PASS, typecheck clean.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: global settings store with validation"`

---

### Task 3: Trial grant + POST /api/trial

**Files:**
- Create: `src/lib/server/trial.ts`, `src/lib/server/trial.test.ts`, `src/app/api/trial/route.ts`, `src/app/api/trial/route.test.ts`

**Interfaces:**
- Consumes: `getSettings`, `grantsForTier`, `adminDb`, `getApp` from `@/config/apps`, `requireUser`, `isLiveStatus`.
- Produces:
  - `buildTrialEntitlement(input: { appId: string; trialDays: number; nowMillis: number }): EntitlementDoc & { trialUsed: true }` — status `'trial'`, tier `'pro'`, planId `'trial'`, expiry `now + trialDays*86400000`, autoRenewing false, razorpaySubscriptionId null, grants = `grantsForTier('pro')`, plus top-level `trialUsed: true`
  - `grantTrial(uid: string, appId: string, trialDays: number, nowMillis: number): Promise<void>` — merge-set doc
  - `POST /api/trial` body `{appId}` auth Bearer — 403 when `freeTrialEnabled` false; 400 unknown app; 409 when existing subscription is live/lifetime/trial-active OR `trialUsed` flag set; else grants using settings.trialDays → 200 `{granted:true, expiresAt}`

- [ ] **Step 1: Failing tests**

`src/lib/server/trial.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'

const { docSet } = vi.hoisted(() => ({ docSet: vi.fn() }))
vi.mock('./firebase-admin', () => ({
  adminDb: () => ({ doc: (path: string) => ({ set: (d: unknown, o?: unknown) => docSet(path, d, o) }) }),
}))

import { buildTrialEntitlement, grantTrial } from './trial'

describe('buildTrialEntitlement', () => {
  it('grants pro entitlements for trialDays with trialUsed flag', () => {
    const doc = buildTrialEntitlement({ appId: 'crackloop', trialDays: 7, nowMillis: 1_000_000 })
    expect(doc.subscription).toMatchObject({
      status: 'trial', planId: 'trial', tier: 'pro',
      expiryTimeMillis: 1_000_000 + 7 * 86_400_000, autoRenewing: false, razorpaySubscriptionId: null, source: 'web',
    })
    expect(doc.entitlements).toEqual({ adFree: true, unlimitedAi: false })
    expect(doc.trialUsed).toBe(true)
  })
})

describe('grantTrial', () => {
  it('merge-sets to users/{uid}/apps/{appId}', async () => {
    await grantTrial('u1', 'crackloop', 7, 5)
    expect(docSet).toHaveBeenCalledWith('users/u1/apps/crackloop', expect.objectContaining({ trialUsed: true }), { merge: true })
  })
})
```

`src/app/api/trial/route.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireUser, getSettings, grantTrial, docGet } = vi.hoisted(() => ({
  requireUser: vi.fn(), getSettings: vi.fn(), grantTrial: vi.fn(), docGet: vi.fn(),
}))
vi.mock('@/lib/server/verify-token', () => ({ requireUser, UnauthorizedError: class extends Error { status = 401 } }))
vi.mock('@/lib/server/settings', () => ({ getSettings }))
vi.mock('@/lib/server/trial', async (importOriginal) => ({ ...(await importOriginal() as object), grantTrial }))
vi.mock('@/lib/server/firebase-admin', () => ({
  adminDb: () => ({ doc: (path: string) => ({ get: () => docGet(path) }) }),
}))

import { POST } from './route'

function req(body: unknown) {
  return new Request('http://x', { method: 'POST', body: JSON.stringify(body), headers: { Authorization: 'Bearer t' } })
}

describe('POST /api/trial', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireUser.mockResolvedValue({ uid: 'u1', email: null })
    getSettings.mockResolvedValue({ freeTrialEnabled: true, trialDays: 7, promoDefaultExpiryMonths: 3 })
    docGet.mockResolvedValue({ exists: false, data: () => undefined })
  })

  it('403 when trials disabled', async () => {
    getSettings.mockResolvedValue({ freeTrialEnabled: false, trialDays: 7, promoDefaultExpiryMonths: 3 })
    expect((await POST(req({ appId: 'crackloop' }))).status).toBe(403)
  })

  it('400 unknown app', async () => {
    expect((await POST(req({ appId: 'nope' }))).status).toBe(400)
  })

  it('409 when trial already used', async () => {
    docGet.mockResolvedValue({ exists: true, data: () => ({ trialUsed: true }) })
    expect((await POST(req({ appId: 'crackloop' }))).status).toBe(409)
    expect(grantTrial).not.toHaveBeenCalled()
  })

  it('409 when live subscription exists', async () => {
    docGet.mockResolvedValue({ exists: true, data: () => ({ subscription: { status: 'active' } }) })
    expect((await POST(req({ appId: 'crackloop' }))).status).toBe(409)
  })

  it('grants trial when eligible', async () => {
    const res = await POST(req({ appId: 'crackloop' }))
    expect(res.status).toBe(200)
    expect(grantTrial).toHaveBeenCalledWith('u1', 'crackloop', 7, expect.any(Number))
    expect((await res.json()).granted).toBe(true)
  })
})
```

Run — Expected: FAIL.

- [ ] **Step 2: Implement**

`src/lib/server/trial.ts`:
```ts
import { adminDb } from './firebase-admin'
import { grantsForTier, type EntitlementDoc } from './entitlements'

export type TrialDoc = EntitlementDoc & { trialUsed: true }

export function buildTrialEntitlement(input: { appId: string; trialDays: number; nowMillis: number }): TrialDoc {
  return {
    subscription: {
      status: 'trial',
      planId: 'trial',
      tier: 'pro',
      expiryTimeMillis: input.nowMillis + input.trialDays * 86_400_000,
      autoRenewing: false,
      razorpaySubscriptionId: null,
      source: 'web',
      lastVerifiedAt: input.nowMillis,
    },
    entitlements: grantsForTier('pro'),
    trialUsed: true,
  }
}

export async function grantTrial(uid: string, appId: string, trialDays: number, nowMillis: number): Promise<void> {
  await adminDb().doc(`users/${uid}/apps/${appId}`).set(buildTrialEntitlement({ appId, trialDays, nowMillis }), { merge: true })
}
```

`src/app/api/trial/route.ts`:
```ts
import { getApp } from '@/config/apps'
import { adminDb } from '@/lib/server/firebase-admin'
import { isLiveStatus } from '@/lib/server/entitlements'
import { getSettings } from '@/lib/server/settings'
import { grantTrial } from '@/lib/server/trial'
import { requireUser, UnauthorizedError } from '@/lib/server/verify-token'

export const runtime = 'nodejs'

export async function POST(req: Request): Promise<Response> {
  let uid: string
  try {
    ;({ uid } = await requireUser(req))
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'unauthorized' }, { status: 401 })
    throw err
  }

  try {
    const body = await req.json().catch(() => ({}))
    if (typeof body.appId !== 'string' || !getApp(body.appId)) {
      return Response.json({ error: 'unknown app' }, { status: 400 })
    }

    const settings = await getSettings()
    if (!settings.freeTrialEnabled) return Response.json({ error: 'trials not available' }, { status: 403 })

    const snap = await adminDb().doc(`users/${uid}/apps/${body.appId}`).get()
    const data = snap.exists ? snap.data() : undefined
    const status: string | undefined = data?.subscription?.status
    const now = Date.now()
    const trialActive = status === 'trial' && (data?.subscription?.expiryTimeMillis ?? 0) > now
    if (data?.trialUsed || trialActive || (typeof status === 'string' && (isLiveStatus(status) || status === 'lifetime'))) {
      return Response.json({ error: 'not eligible for trial' }, { status: 409 })
    }

    await grantTrial(uid, body.appId, settings.trialDays, now)
    return Response.json({ granted: true, expiresAt: now + settings.trialDays * 86_400_000 })
  } catch (err) {
    console.error('trial grant failed', err)
    return Response.json({ error: 'trial failed' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verify** — tests PASS, typecheck, build.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: free trial grants with settings gating"`

---

### Task 4: Trial request button in account

**Files:**
- Modify: `src/app/account/account-view.tsx`
- Create: none (no new test — flow covered by route tests; UI verified in final browser pass)

**Interfaces:** consumes existing `Summary` state + `/api/trial`.

- [ ] **Step 1: Implement**

In `account-view.tsx`:
1. Add state: `const [trialMsg, setTrialMsg] = useState<string | null>(null)` and `const [trialPending, setTrialPending] = useState(false)`.
2. Add handler:
```tsx
async function requestTrial(appId: string) {
  if (!user) return
  setTrialPending(true)
  setTrialMsg(null)
  try {
    const token = await user.getIdToken()
    const res = await fetch('/api/trial', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setTrialMsg(data.error === 'not eligible for trial' ? 'Trial not available for this account.' : 'Trial not available right now.')
      return
    }
    setTrialMsg('Trial started!')
    await load()
  } finally {
    setTrialPending(false)
  }
}
```
3. In the "No subscriptions yet." empty-state Card, under the "See plans" button, add:
```tsx
<Button variant="outline" size="sm" disabled={trialPending} onClick={() => void requestTrial('crackloop')}>
  {trialPending ? 'Starting trial…' : 'Try free trial'}
</Button>
{trialMsg ? <p role="status" className="mt-2 text-xs text-muted">{trialMsg}</p> : null}
```
4. In per-app cards where `subscription` is null, add the same button (pass that `appId`).
5. Render `status === 'trial'` subscriptions distinctly: Badge tone `default` with text `trial`, expiry line "Trial ends <date>".

- [ ] **Step 2: Verify** — `pnpm test && pnpm typecheck && pnpm build` green (no test changes expected).
- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: free trial request from account page"`

---

### Task 5: Admin data module (metrics, users, plan mutations, webhook log)

**Files:**
- Create: `src/lib/server/admin-data.ts`, `src/lib/server/admin-data.test.ts`

**Interfaces:**
- Consumes: `adminDb`, `adminAuth`, `createPlan` — NEW razorpay helper (add to `src/lib/server/razorpay.ts`): `createPlan(input: { name: string; amountPaise: number; intervalMonths: number }): Promise<{ id: string }>` → POST `/plans` `{period:'monthly', interval: intervalMonths, item:{name, amount, currency:'INR'}}`.
- Produces (all admin-only callers):
  - `getMetrics(): Promise<{ totalRevenuePaise: number; paymentCount: number; userCount: number; activeSubscriptionCount: number; webhookEventCount: number }>` — revenue via `collectionGroup('payments')` sum/count; users via `adminAuth().listUsers(1000)` length; active subs = count of `razorpaySubscriptions` docs; webhook count = `webhookEvents` count aggregate (`.count().get()` where available; plain `.get().size` acceptable)
  - `listUsers(q?: string): Promise<Array<{ uid: string; email: string | null; displayName: string | null; admin: boolean; createdAt: string }>>` — from `listUsers(1000)`, case-insensitive email/name filter on `q`
  - `getUserDetail(uid: string): Promise<{ profile: { uid; email; displayName } | null; apps: Array<{ appId: string; data: any }>; payments: any[] }>` — auth record + apps subcollection + payments (desc, limit 20); null profile when auth record missing
  - `revokeEntitlement(uid: string, appId: string): Promise<void>` — merge-set `{subscription: {status:'revoked', autoRenewing:false}, entitlements:{adFree:false, unlimitedAi:false}}` via set-merge (NOT mergeFields — entitlements object replaced whole)
  - `createPlanWithRazorpay(input: { id: string; appId: string; tier: 'pro'|'ai'; durationMonths: 1|3|6|12|null; lifetime: boolean; pricePaise: number; playStorePricePaise: number|null; sort: number }): Promise<StoredPlan>` — validates (id slug `[a-z0-9-]{3,40}`, unique — doc must not exist; pricePaise positive integer; lifetime XOR durationMonths); creates razorpay plan when not lifetime; writes `plans/{id}` with `active: true`
  - `updatePlanFields(planId: string, patch: { playStorePricePaise?: number|null; sort?: number; active?: boolean }): Promise<void>` — rejects unknown keys and any attempt to change pricePaise/razorpayPlanId/tier/duration (immutable)
  - `listWebhookEvents(limit = 50): Promise<Array<{ id: string; event: string; receivedAt: number }>>` — ordered receivedAt desc

- [ ] **Step 1: Failing tests** (representative — all use vi.hoisted mocks for firebase-admin + razorpay)

`src/lib/server/admin-data.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { docGet, docSet, collGet, listUsersFn, createPlan } = vi.hoisted(() => ({
  docGet: vi.fn(), docSet: vi.fn(), collGet: vi.fn(), listUsersFn: vi.fn(), createPlan: vi.fn(),
}))
vi.mock('./firebase-admin', () => ({
  adminDb: () => ({
    doc: (path: string) => ({ get: () => docGet(path), set: (d: unknown, o?: unknown) => docSet(path, d, o) }),
    collection: () => ({ orderBy: () => ({ limit: () => ({ get: collGet }) }), get: collGet }),
    collectionGroup: () => ({ get: collGet }),
  }),
  adminAuth: () => ({ listUsers: listUsersFn, getUser: vi.fn() }),
}))
vi.mock('./razorpay', () => ({ createPlan }))

import { createPlanWithRazorpay, listUsers, revokeEntitlement, updatePlanFields } from './admin-data'

describe('listUsers', () => {
  beforeEach(() => vi.clearAllMocks())
  it('maps and filters users case-insensitively', async () => {
    listUsersFn.mockResolvedValue({
      users: [
        { uid: 'u1', email: 'Alice@x.com', displayName: 'Alice', customClaims: { admin: true }, metadata: { creationTime: 't1' } },
        { uid: 'u2', email: 'bob@x.com', displayName: null, customClaims: undefined, metadata: { creationTime: 't2' } },
      ],
    })
    const all = await listUsers()
    expect(all).toHaveLength(2)
    expect(all[0]).toEqual({ uid: 'u1', email: 'Alice@x.com', displayName: 'Alice', admin: true, createdAt: 't1' })
    expect(await listUsers('ALICE')).toHaveLength(1)
    expect(await listUsers('nobody')).toHaveLength(0)
  })
})

describe('revokeEntitlement', () => {
  it('zeroes grants and marks revoked with merge', async () => {
    await revokeEntitlement('u1', 'crackloop')
    expect(docSet).toHaveBeenCalledWith(
      'users/u1/apps/crackloop',
      { subscription: { status: 'revoked', autoRenewing: false }, entitlements: { adFree: false, unlimitedAi: false } },
      { merge: true },
    )
  })
})

describe('createPlanWithRazorpay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    docGet.mockResolvedValue({ exists: false })
    createPlan.mockResolvedValue({ id: 'plan_new' })
  })
  const base = { id: 'crackloop-pro-3m', appId: 'crackloop', tier: 'pro' as const, durationMonths: 3 as const, lifetime: false, pricePaise: 19900, playStorePricePaise: 24900, sort: 5 }

  it('creates razorpay plan and firestore doc for recurring', async () => {
    const plan = await createPlanWithRazorpay(base)
    expect(createPlan).toHaveBeenCalledWith({ name: 'crackloop pro 3m', amountPaise: 19900, intervalMonths: 3 })
    expect(docSet).toHaveBeenCalledWith('plans/crackloop-pro-3m', expect.objectContaining({ razorpayPlanId: 'plan_new', active: true }), undefined)
    expect(plan.razorpayPlanId).toBe('plan_new')
  })

  it('skips razorpay for lifetime', async () => {
    await createPlanWithRazorpay({ ...base, id: 'crackloop-ai-life', lifetime: true, durationMonths: null })
    expect(createPlan).not.toHaveBeenCalled()
  })

  it('rejects duplicate id, bad slug, bad price, lifetime+duration mismatch', async () => {
    docGet.mockResolvedValue({ exists: true })
    await expect(createPlanWithRazorpay(base)).rejects.toThrow(/exists/)
    docGet.mockResolvedValue({ exists: false })
    await expect(createPlanWithRazorpay({ ...base, id: 'Bad Slug!' })).rejects.toThrow(/id/)
    await expect(createPlanWithRazorpay({ ...base, pricePaise: -5 })).rejects.toThrow(/price/)
    await expect(createPlanWithRazorpay({ ...base, lifetime: true })).rejects.toThrow(/lifetime/)
  })
})

describe('updatePlanFields', () => {
  it('allows only mutable fields', async () => {
    await updatePlanFields('p1', { active: false, sort: 9 })
    expect(docSet).toHaveBeenCalledWith('plans/p1', { active: false, sort: 9 }, { merge: true })
    await expect(updatePlanFields('p1', { pricePaise: 100 } as never)).rejects.toThrow(/immutable|unknown/)
  })
})
```

Run — Expected: FAIL.

- [ ] **Step 2: Implement**

Add to `src/lib/server/razorpay.ts`:
```ts
export async function createPlan(input: { name: string; amountPaise: number; intervalMonths: number }): Promise<{ id: string }> {
  const json = await rzpFetch('/plans', {
    period: 'monthly',
    interval: input.intervalMonths,
    item: { name: input.name, amount: input.amountPaise, currency: 'INR' },
  })
  return { id: json.id }
}
```

`src/lib/server/admin-data.ts`:
```ts
import type { StoredPlan } from '@/config/plans'
import { adminAuth, adminDb } from './firebase-admin'
import { createPlan } from './razorpay'

export async function getMetrics() {
  const db = adminDb()
  const [paymentsSnap, subsSnap, eventsSnap, usersResult] = await Promise.all([
    db.collectionGroup('payments').get(),
    db.collection('razorpaySubscriptions').get(),
    db.collection('webhookEvents').get(),
    adminAuth().listUsers(1000),
  ])
  let totalRevenuePaise = 0
  paymentsSnap.forEach((d) => {
    const amt = d.data().amountPaise
    if (Number.isInteger(amt)) totalRevenuePaise += amt
  })
  return {
    totalRevenuePaise,
    paymentCount: paymentsSnap.size,
    userCount: usersResult.users.length,
    activeSubscriptionCount: subsSnap.size,
    webhookEventCount: eventsSnap.size,
  }
}

export async function listUsers(q?: string) {
  const result = await adminAuth().listUsers(1000)
  const users = result.users.map((u) => ({
    uid: u.uid,
    email: u.email ?? null,
    displayName: u.displayName ?? null,
    admin: u.customClaims?.admin === true,
    createdAt: u.metadata.creationTime,
  }))
  if (!q) return users
  const needle = q.toLowerCase()
  return users.filter(
    (u) => u.email?.toLowerCase().includes(needle) || u.displayName?.toLowerCase().includes(needle) || u.uid === q,
  )
}

export async function getUserDetail(uid: string) {
  const db = adminDb()
  const [authUser, appsRefs, paymentsSnap] = await Promise.all([
    adminAuth()
      .getUser(uid)
      .catch(() => null),
    db.collection(`users/${uid}/apps`).get(),
    db.collection(`users/${uid}/payments`).orderBy('createdAt', 'desc').limit(20).get(),
  ])
  return {
    profile: authUser ? { uid: authUser.uid, email: authUser.email ?? null, displayName: authUser.displayName ?? null } : null,
    apps: appsRefs.docs.map((d) => ({ appId: d.id, data: d.data() })),
    payments: paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  }
}

export async function revokeEntitlement(uid: string, appId: string): Promise<void> {
  await adminDb().doc(`users/${uid}/apps/${appId}`).set(
    {
      subscription: { status: 'revoked', autoRenewing: false },
      entitlements: { adFree: false, unlimitedAi: false },
    },
    { merge: true },
  )
}

const PLAN_ID_RE = /^[a-z0-9-]{3,40}$/

export async function createPlanWithRazorpay(input: {
  id: string
  appId: string
  tier: 'pro' | 'ai'
  durationMonths: 1 | 3 | 6 | 12 | null
  lifetime: boolean
  pricePaise: number
  playStorePricePaise: number | null
  sort: number
}): Promise<StoredPlan> {
  if (!PLAN_ID_RE.test(input.id)) throw new Error('id must be a slug: [a-z0-9-]{3,40}')
  if (!Number.isInteger(input.pricePaise) || input.pricePaise <= 0) throw new Error('price must be positive integer paise')
  if (input.lifetime !== (input.durationMonths === null)) throw new Error('lifetime plans must have null duration (and vice versa)')

  const ref = adminDb().doc(`plans/${input.id}`)
  if ((await ref.get()).exists) throw new Error(`plan ${input.id} already exists`)

  const razorpayPlanId = input.lifetime
    ? null
    : (
        await createPlan({
          name: `${input.appId} ${input.tier} ${input.durationMonths}m`,
          amountPaise: input.pricePaise,
          intervalMonths: input.durationMonths!,
        })
      ).id

  const plan: StoredPlan = { ...input, razorpayPlanId, active: true }
  await ref.set(plan)
  return plan
}

const MUTABLE_PLAN_FIELDS = new Set(['playStorePricePaise', 'sort', 'active'])

export async function updatePlanFields(
  planId: string,
  patch: { playStorePricePaise?: number | null; sort?: number; active?: boolean },
): Promise<void> {
  for (const key of Object.keys(patch)) {
    if (!MUTABLE_PLAN_FIELDS.has(key)) throw new Error(`field ${key} is immutable or unknown`)
  }
  await adminDb().doc(`plans/${planId}`).set(patch, { merge: true })
}

export async function listWebhookEvents(limit = 50) {
  const snap = await adminDb().collection('webhookEvents').orderBy('receivedAt', 'desc').limit(limit).get()
  return snap.docs.map((d) => ({ id: d.id, event: d.data().event as string, receivedAt: d.data().receivedAt as number }))
}
```

- [ ] **Step 3: Verify** — tests PASS, typecheck, build.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: admin data module (metrics, users, plan crud, webhook log)"`

---

### Task 6: Admin API routes

**Files:**
- Create: `src/app/api/admin/metrics/route.ts`, `src/app/api/admin/users/route.ts`, `src/app/api/admin/users/[uid]/route.ts`, `src/app/api/admin/plans/route.ts`, `src/app/api/admin/plans/[planId]/route.ts`, `src/app/api/admin/settings/route.ts`, `src/app/api/admin/webhooks/route.ts`, `src/app/api/admin/admin-routes.test.ts`

**Interfaces:**
- Every route: `requireAdmin` first → 401/403 JSON; wraps work in try/catch → 500 generic + console.error. All `runtime = 'nodejs'`.
- `GET /api/admin/metrics` → `getMetrics()`
- `GET /api/admin/users?q=` → `listUsers(q ?? undefined)`
- `GET /api/admin/users/[uid]` → `getUserDetail(uid)`; `POST /api/admin/users/[uid]` body `{action: 'grant-trial'|'revoke', appId: string, trialDays?: number}` — grant-trial uses `trialDays ?? settings.trialDays` via `grantTrial` (admin grant IGNORES freeTrialEnabled + trialUsed — admin override, but still sets trialUsed); revoke uses `revokeEntitlement`; unknown action → 400
- `GET /api/admin/plans` → ALL plans incl. inactive: direct `adminDb().collection('plans').orderBy('sort').get()` (fallback-free — admin needs truth; error → 500); `POST` body → `createPlanWithRazorpay` (validation errors → 400 with message)
- `PATCH /api/admin/plans/[planId]` body patch → `updatePlanFields` (errors → 400)
- `GET /api/admin/settings` → `getSettings()`; `PUT` body → `updateSettings` (validation errors → 400)
- `GET /api/admin/webhooks` → `listWebhookEvents(50)`

A shared helper INSIDE each route file is fine, but DRY via one small module is better — create `src/app/api/admin/_lib.ts`:
```ts
import { ForbiddenError, requireAdmin } from '@/lib/server/require-admin'
import { UnauthorizedError } from '@/lib/server/verify-token'

export async function withAdmin(req: Request, fn: () => Promise<Response>): Promise<Response> {
  try {
    await requireAdmin(req)
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'unauthorized' }, { status: 401 })
    if (err instanceof ForbiddenError) return Response.json({ error: 'forbidden' }, { status: 403 })
    throw err
  }
  try {
    return await fn()
  } catch (err) {
    console.error('admin api failed', err)
    return Response.json({ error: 'internal error' }, { status: 500 })
  }
}
```

- [ ] **Step 1: Failing tests**

`src/app/api/admin/admin-routes.test.ts` (one file covering the guard matrix + representative handlers):
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireAdmin, getMetrics, listUsers, getUserDetail, grantTrial, revokeEntitlement, getSettings, updateSettings, createPlanWithRazorpay, updatePlanFields, listWebhookEvents, plansGet } = vi.hoisted(() => ({
  requireAdmin: vi.fn(), getMetrics: vi.fn(), listUsers: vi.fn(), getUserDetail: vi.fn(),
  grantTrial: vi.fn(), revokeEntitlement: vi.fn(), getSettings: vi.fn(), updateSettings: vi.fn(),
  createPlanWithRazorpay: vi.fn(), updatePlanFields: vi.fn(), listWebhookEvents: vi.fn(), plansGet: vi.fn(),
}))
vi.mock('@/lib/server/require-admin', () => ({
  requireAdmin,
  ForbiddenError: class extends Error { status = 403 },
}))
vi.mock('@/lib/server/verify-token', () => ({ UnauthorizedError: class extends Error { status = 401 } }))
vi.mock('@/lib/server/admin-data', () => ({ getMetrics, listUsers, getUserDetail, revokeEntitlement, createPlanWithRazorpay, updatePlanFields, listWebhookEvents }))
vi.mock('@/lib/server/trial', () => ({ grantTrial }))
vi.mock('@/lib/server/settings', () => ({ getSettings, updateSettings }))
vi.mock('@/lib/server/firebase-admin', () => ({
  adminDb: () => ({ collection: () => ({ orderBy: () => ({ get: plansGet }) }) }),
}))

import { GET as metricsGET } from './metrics/route'
import { GET as usersGET } from './users/route'
import { GET as userGET, POST as userPOST } from './users/[uid]/route'
import { GET as plansGET, POST as plansPOST } from './plans/route'
import { PATCH as planPATCH } from './plans/[planId]/route'
import { GET as settingsGET, PUT as settingsPUT } from './settings/route'
import { GET as webhooksGET } from './webhooks/route'

const authed = { headers: { Authorization: 'Bearer t' } }

describe('admin guard matrix', () => {
  beforeEach(() => vi.clearAllMocks())

  it('401 when unauthenticated', async () => {
    const { UnauthorizedError } = await import('@/lib/server/verify-token')
    requireAdmin.mockRejectedValue(new UnauthorizedError('no'))
    expect((await metricsGET(new Request('http://x'))).status).toBe(401)
  })

  it('403 when not admin', async () => {
    const { ForbiddenError } = await import('@/lib/server/require-admin')
    requireAdmin.mockRejectedValue(new ForbiddenError('no'))
    expect((await metricsGET(new Request('http://x', authed))).status).toBe(403)
  })
})

describe('admin handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdmin.mockResolvedValue({ uid: 'admin', email: 'a@b.c' })
  })

  it('metrics returns data', async () => {
    getMetrics.mockResolvedValue({ totalRevenuePaise: 100 })
    const res = await metricsGET(new Request('http://x', authed))
    expect((await res.json()).totalRevenuePaise).toBe(100)
  })

  it('users list passes q', async () => {
    listUsers.mockResolvedValue([])
    await usersGET(new Request('http://x/api/admin/users?q=alice', authed))
    expect(listUsers).toHaveBeenCalledWith('alice')
  })

  it('user detail by uid', async () => {
    getUserDetail.mockResolvedValue({ profile: null, apps: [], payments: [] })
    const res = await userGET(new Request('http://x', authed), { params: Promise.resolve({ uid: 'u9' }) })
    expect(getUserDetail).toHaveBeenCalledWith('u9')
    expect(res.status).toBe(200)
  })

  it('user action grant-trial with explicit days', async () => {
    const res = await userPOST(
      new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'grant-trial', appId: 'crackloop', trialDays: 30 }) }),
      { params: Promise.resolve({ uid: 'u9' }) },
    )
    expect(res.status).toBe(200)
    expect(grantTrial).toHaveBeenCalledWith('u9', 'crackloop', 30, expect.any(Number))
  })

  it('user action revoke', async () => {
    await userPOST(
      new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'revoke', appId: 'crackloop' }) }),
      { params: Promise.resolve({ uid: 'u9' }) },
    )
    expect(revokeEntitlement).toHaveBeenCalledWith('u9', 'crackloop')
  })

  it('unknown action 400', async () => {
    const res = await userPOST(
      new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'nuke', appId: 'crackloop' }) }),
      { params: Promise.resolve({ uid: 'u9' }) },
    )
    expect(res.status).toBe(400)
  })

  it('plans GET lists all incl inactive', async () => {
    plansGet.mockResolvedValue({ docs: [{ data: () => ({ id: 'p1', active: false }) }] })
    const res = await plansGET(new Request('http://x', authed))
    expect((await res.json()).plans).toEqual([{ id: 'p1', active: false }])
  })

  it('plans POST validation error -> 400 with message', async () => {
    createPlanWithRazorpay.mockRejectedValue(new Error('id must be a slug'))
    const res = await plansPOST(new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ id: 'X' }) }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/slug/)
  })

  it('plan PATCH forwards patch', async () => {
    await planPATCH(
      new Request('http://x', { ...authed, method: 'PATCH', body: JSON.stringify({ active: false }) }),
      { params: Promise.resolve({ planId: 'p1' }) },
    )
    expect(updatePlanFields).toHaveBeenCalledWith('p1', { active: false })
  })

  it('settings GET + PUT', async () => {
    getSettings.mockResolvedValue({ freeTrialEnabled: false, trialDays: 7, promoDefaultExpiryMonths: 3 })
    expect((await settingsGET(new Request('http://x', authed))).status).toBe(200)
    updateSettings.mockResolvedValue({ freeTrialEnabled: true, trialDays: 7, promoDefaultExpiryMonths: 3 })
    const res = await settingsPUT(new Request('http://x', { ...authed, method: 'PUT', body: JSON.stringify({ freeTrialEnabled: true }) }))
    expect(updateSettings).toHaveBeenCalledWith({ freeTrialEnabled: true })
    expect(res.status).toBe(200)
  })

  it('webhooks GET', async () => {
    listWebhookEvents.mockResolvedValue([{ id: 'e1', event: 'x', receivedAt: 1 }])
    const res = await webhooksGET(new Request('http://x', authed))
    expect((await res.json()).events).toHaveLength(1)
  })
})
```

Run — Expected: FAIL.

- [ ] **Step 2: Implement routes** (each thin; representative shapes)

`src/app/api/admin/metrics/route.ts`:
```ts
import { getMetrics } from '@/lib/server/admin-data'
import { withAdmin } from '../_lib'

export const runtime = 'nodejs'

export async function GET(req: Request): Promise<Response> {
  return withAdmin(req, async () => Response.json(await getMetrics()))
}
```

`src/app/api/admin/users/route.ts`:
```ts
import { listUsers } from '@/lib/server/admin-data'
import { withAdmin } from '../_lib'

export const runtime = 'nodejs'

export async function GET(req: Request): Promise<Response> {
  return withAdmin(req, async () => {
    const q = new URL(req.url).searchParams.get('q')
    return Response.json({ users: await listUsers(q ?? undefined) })
  })
}
```

`src/app/api/admin/users/[uid]/route.ts`:
```ts
import { getApp } from '@/config/apps'
import { getUserDetail, revokeEntitlement } from '@/lib/server/admin-data'
import { getSettings } from '@/lib/server/settings'
import { grantTrial } from '@/lib/server/trial'
import { withAdmin } from '../../_lib'

export const runtime = 'nodejs'

export async function GET(req: Request, ctx: { params: Promise<{ uid: string }> }): Promise<Response> {
  return withAdmin(req, async () => {
    const { uid } = await ctx.params
    return Response.json(await getUserDetail(uid))
  })
}

export async function POST(req: Request, ctx: { params: Promise<{ uid: string }> }): Promise<Response> {
  return withAdmin(req, async () => {
    const { uid } = await ctx.params
    const body = await req.json().catch(() => ({}))
    if (typeof body.appId !== 'string' || !getApp(body.appId)) {
      return Response.json({ error: 'unknown app' }, { status: 400 })
    }
    if (body.action === 'grant-trial') {
      const days = body.trialDays ?? (await getSettings()).trialDays
      if (!Number.isInteger(days) || days < 1 || days > 365) return Response.json({ error: 'invalid trialDays' }, { status: 400 })
      await grantTrial(uid, body.appId, days, Date.now())
      return Response.json({ ok: true })
    }
    if (body.action === 'revoke') {
      await revokeEntitlement(uid, body.appId)
      return Response.json({ ok: true })
    }
    return Response.json({ error: 'unknown action' }, { status: 400 })
  })
}
```

`src/app/api/admin/plans/route.ts`:
```ts
import { createPlanWithRazorpay } from '@/lib/server/admin-data'
import { adminDb } from '@/lib/server/firebase-admin'
import { withAdmin } from '../_lib'

export const runtime = 'nodejs'

export async function GET(req: Request): Promise<Response> {
  return withAdmin(req, async () => {
    const snap = await adminDb().collection('plans').orderBy('sort').get()
    return Response.json({ plans: snap.docs.map((d) => d.data()) })
  })
}

export async function POST(req: Request): Promise<Response> {
  return withAdmin(req, async () => {
    const body = await req.json().catch(() => ({}))
    try {
      return Response.json({ plan: await createPlanWithRazorpay(body) })
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : 'invalid plan' }, { status: 400 })
    }
  })
}
```

`src/app/api/admin/plans/[planId]/route.ts`:
```ts
import { updatePlanFields } from '@/lib/server/admin-data'
import { withAdmin } from '../../_lib'

export const runtime = 'nodejs'

export async function PATCH(req: Request, ctx: { params: Promise<{ planId: string }> }): Promise<Response> {
  return withAdmin(req, async () => {
    const { planId } = await ctx.params
    const body = await req.json().catch(() => ({}))
    try {
      await updatePlanFields(planId, body)
      return Response.json({ ok: true })
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : 'invalid patch' }, { status: 400 })
    }
  })
}
```

`src/app/api/admin/settings/route.ts`:
```ts
import { getSettings, updateSettings } from '@/lib/server/settings'
import { withAdmin } from '../_lib'

export const runtime = 'nodejs'

export async function GET(req: Request): Promise<Response> {
  return withAdmin(req, async () => Response.json(await getSettings()))
}

export async function PUT(req: Request): Promise<Response> {
  return withAdmin(req, async () => {
    const body = await req.json().catch(() => ({}))
    try {
      return Response.json(await updateSettings(body))
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : 'invalid settings' }, { status: 400 })
    }
  })
}
```

`src/app/api/admin/webhooks/route.ts`:
```ts
import { listWebhookEvents } from '@/lib/server/admin-data'
import { withAdmin } from '../_lib'

export const runtime = 'nodejs'

export async function GET(req: Request): Promise<Response> {
  return withAdmin(req, async () => Response.json({ events: await listWebhookEvents(50) }))
}
```

Plus `src/app/api/admin/_lib.ts` (code in Interfaces above). Note: `_lib.ts` has no route exports — Next ignores non-route files without HTTP-method exports; the underscore prefix keeps it out of routing.

- [ ] **Step 3: Verify** — tests PASS, typecheck, build (routes listed as ƒ).
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: admin api routes with role guard"`

---

### Task 7: Admin UI shell + fetch helper + gate

**Files:**
- Create: `src/components/admin/admin-fetch.ts`, `src/components/admin/admin-gate.tsx`, `src/app/admin/layout.tsx`, `src/components/admin/admin-gate.test.tsx`

**Interfaces:**
- `adminFetch(user: User, path: string, init?: RequestInit): Promise<Response>` — adds `Authorization: Bearer <idToken>` + JSON content-type
- `<AdminGate>{children}</AdminGate>` client component: `useAuth()`; loading → skeleton; signed out → sign-in prompt (Button → signIn); signed in → probe `GET /api/admin/settings` once — 200 → render children; 403 → "Not authorized" card with home link; error → retry card
- `src/app/admin/layout.tsx` — server component rendering `<AdminGate>` + section nav (Overview `/admin`, Users `/admin/users`, Plans `/admin/plans`, Settings `/admin/settings`, Webhooks `/admin/webhooks`) as horizontal scrollable tab row (mobile-friendly)

- [ ] **Step 1: Failing test**

`src/components/admin/admin-gate.test.tsx`:
```tsx
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockAuth } = vi.hoisted(() => ({ mockAuth: { user: null as any, loading: false, signIn: vi.fn(), signOut: vi.fn() } }))
vi.mock('@/lib/auth-context', () => ({ useAuth: () => mockAuth }))

import { AdminGate } from './admin-gate'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AdminGate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('prompts sign-in when signed out', () => {
    mockAuth.user = null
    render(<AdminGate>secret</AdminGate>)
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
  })

  it('renders children for admin', async () => {
    mockAuth.user = { getIdToken: vi.fn().mockResolvedValue('t') }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
    render(<AdminGate>secret</AdminGate>)
    await waitFor(() => expect(screen.getByText('secret')).toBeInTheDocument())
  })

  it('shows not-authorized on 403', async () => {
    mockAuth.user = { getIdToken: vi.fn().mockResolvedValue('t') }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 403 })))
    render(<AdminGate>secret</AdminGate>)
    await waitFor(() => expect(screen.getByText(/not authorized/i)).toBeInTheDocument())
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
  })
})
```

Run — Expected: FAIL.

- [ ] **Step 2: Implement**

`src/components/admin/admin-fetch.ts`:
```ts
import type { User } from 'firebase/auth'

export async function adminFetch(user: User, path: string, init?: RequestInit): Promise<Response> {
  const token = await user.getIdToken()
  return fetch(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
}
```

`src/components/admin/admin-gate.tsx`:
```tsx
'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/lib/auth-context'
import { adminFetch } from './admin-fetch'

type GateState = 'checking' | 'allowed' | 'forbidden' | 'error'

export function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, loading, signIn } = useAuth()
  const [state, setState] = useState<GateState>('checking')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (loading || !user) return
    let cancelled = false
    setState('checking')
    adminFetch(user, '/api/admin/settings')
      .then((res) => {
        if (cancelled) return
        setState(res.ok ? 'allowed' : res.status === 403 ? 'forbidden' : 'error')
      })
      .catch(() => !cancelled && setState('error'))
    return () => {
      cancelled = true
    }
  }, [user, loading, attempt])

  if (loading) return <p className="px-4 py-16 text-center text-muted">Loading…</p>
  if (!user) {
    return (
      <Card className="mx-auto mt-16 max-w-sm text-center">
        <p className="text-sm text-muted">Admin area</p>
        <div className="mt-4">
          <Button onClick={() => void signIn()}>Sign in</Button>
        </div>
      </Card>
    )
  }
  if (state === 'checking') return <p className="px-4 py-16 text-center text-muted">Checking access…</p>
  if (state === 'forbidden') {
    return (
      <Card className="mx-auto mt-16 max-w-sm text-center">
        <p className="font-medium text-fg">Not authorized</p>
        <p className="mt-2 text-sm text-muted">This area is for administrators.</p>
        <div className="mt-4">
          <Button href="/" variant="outline" size="sm">Back home</Button>
        </div>
      </Card>
    )
  }
  if (state === 'error') {
    return (
      <Card className="mx-auto mt-16 max-w-sm text-center">
        <p role="alert" className="text-sm text-red-500">Couldn’t check access.</p>
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={() => setAttempt((a) => a + 1)}>Retry</Button>
        </div>
      </Card>
    )
  }
  return <>{children}</>
}
```

`src/app/admin/layout.tsx`:
```tsx
import Link from 'next/link'
import type { Metadata } from 'next'
import { AdminGate } from '@/components/admin/admin-gate'

export const metadata: Metadata = { title: 'Admin', robots: { index: false } }

const SECTIONS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/plans', label: 'Plans' },
  { href: '/admin/settings', label: 'Settings' },
  { href: '/admin/webhooks', label: 'Webhooks' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-2xl font-bold text-fg">Admin</h1>
      <nav aria-label="Admin sections" className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="whitespace-nowrap rounded-full border border-line px-4 py-1.5 text-sm text-muted hover:bg-card hover:text-fg"
          >
            {s.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">
        <AdminGate>{children}</AdminGate>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify** — tests PASS, typecheck, build.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: admin shell, access gate, authed fetch helper"`

---

### Task 8: Admin UI — Overview + Webhooks + Settings

**Files:**
- Create: `src/components/admin/overview.tsx`, `src/components/admin/webhooks.tsx`, `src/components/admin/settings.tsx`, `src/app/admin/page.tsx`, `src/app/admin/webhooks/page.tsx`, `src/app/admin/settings/page.tsx`

**Interfaces:** each page.tsx is a 3-line server component rendering the client component. All client components: `useAuth` + `adminFetch`, loading/error/retry states, mobile-first.

- [ ] **Step 1: Implement**

`src/app/admin/page.tsx`:
```tsx
import { AdminOverview } from '@/components/admin/overview'

export default function AdminOverviewPage() {
  return <AdminOverview />
}
```
(same 3-line pattern for `webhooks/page.tsx` → `AdminWebhooks`, `settings/page.tsx` → `AdminSettings`.)

`src/components/admin/overview.tsx`:
```tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatINR } from '@/lib/format'
import { useAuth } from '@/lib/auth-context'
import { adminFetch } from './admin-fetch'

type Metrics = {
  totalRevenuePaise: number
  paymentCount: number
  userCount: number
  activeSubscriptionCount: number
  webhookEventCount: number
}

export function AdminOverview() {
  const { user } = useAuth()
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setError(false)
    try {
      const res = await adminFetch(user, '/api/admin/metrics')
      if (!res.ok) throw new Error('metrics failed')
      setMetrics(await res.json())
    } catch {
      setError(true)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  if (error) {
    return (
      <Card>
        <p role="alert" className="text-sm text-red-500">Couldn’t load metrics.</p>
        <div className="mt-4"><Button variant="outline" size="sm" onClick={() => void load()}>Retry</Button></div>
      </Card>
    )
  }
  if (!metrics) return <p className="text-sm text-muted">Loading…</p>

  const stats = [
    { label: 'Revenue', value: formatINR(metrics.totalRevenuePaise) },
    { label: 'Payments', value: String(metrics.paymentCount) },
    { label: 'Users', value: String(metrics.userCount) },
    { label: 'Subscriptions created', value: String(metrics.activeSubscriptionCount) },
    { label: 'Webhook events', value: String(metrics.webhookEventCount) },
  ]
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((s) => (
        <Card key={s.label} className="p-4">
          <p className="text-xs text-muted">{s.label}</p>
          <p className="mt-1 text-xl font-bold text-fg">{s.value}</p>
        </Card>
      ))}
    </div>
  )
}
```

`src/components/admin/webhooks.tsx`:
```tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table } from '@/components/ui/table'
import { useAuth } from '@/lib/auth-context'
import { adminFetch } from './admin-fetch'

type Event = { id: string; event: string; receivedAt: number }

export function AdminWebhooks() {
  const { user } = useAuth()
  const [events, setEvents] = useState<Event[] | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setError(false)
    try {
      const res = await adminFetch(user, '/api/admin/webhooks')
      if (!res.ok) throw new Error('failed')
      setEvents((await res.json()).events)
    } catch {
      setError(true)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  if (error) {
    return (
      <Card>
        <p role="alert" className="text-sm text-red-500">Couldn’t load events.</p>
        <div className="mt-4"><Button variant="outline" size="sm" onClick={() => void load()}>Retry</Button></div>
      </Card>
    )
  }
  if (!events) return <p className="text-sm text-muted">Loading…</p>
  if (events.length === 0) return <p className="text-sm text-muted">No webhook events yet.</p>

  return (
    <Table head={['Event', 'Received', 'Key']}>
      {events.map((e) => (
        <tr key={e.id}>
          <td className="px-4 py-3 text-fg">{e.event}</td>
          <td className="px-4 py-3 text-muted">{new Date(e.receivedAt).toLocaleString()}</td>
          <td className="px-4 py-3 font-mono text-xs text-muted">{e.id}</td>
        </tr>
      ))}
    </Table>
  )
}
```

`src/components/admin/settings.tsx`:
```tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth-context'
import { adminFetch } from './admin-fetch'

type Settings = { freeTrialEnabled: boolean; trialDays: number; promoDefaultExpiryMonths: number }

export function AdminSettings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    const res = await adminFetch(user, '/api/admin/settings')
    if (res.ok) setSettings(await res.json())
    else setMsg('Failed to load settings.')
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    if (!user || !settings) return
    setSaving(true)
    setMsg(null)
    try {
      const res = await adminFetch(user, '/api/admin/settings', { method: 'PUT', body: JSON.stringify(settings) })
      const data = await res.json().catch(() => ({}))
      setMsg(res.ok ? 'Saved.' : (data.error ?? 'Save failed.'))
      if (res.ok) setSettings(data)
    } finally {
      setSaving(false)
    }
  }

  if (!settings) return <p className="text-sm text-muted">{msg ?? 'Loading…'}</p>

  return (
    <Card className="max-w-md">
      <label className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-fg">Free trials enabled</span>
        <input
          type="checkbox"
          checked={settings.freeTrialEnabled}
          onChange={(e) => setSettings({ ...settings, freeTrialEnabled: e.target.checked })}
          className="h-5 w-5 accent-accent"
        />
      </label>
      <div className="mt-4">
        <Input
          label="Trial length (days)"
          type="number"
          min={1}
          max={365}
          value={settings.trialDays}
          onChange={(e) => setSettings({ ...settings, trialDays: Number(e.target.value) })}
        />
      </div>
      <div className="mt-4">
        <Input
          label="Promo code default expiry (months)"
          type="number"
          min={1}
          max={24}
          value={settings.promoDefaultExpiryMonths}
          onChange={(e) => setSettings({ ...settings, promoDefaultExpiryMonths: Number(e.target.value) })}
        />
      </div>
      <div className="mt-6 flex items-center gap-3">
        <Button size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
        {msg ? <p role="status" className="text-xs text-muted">{msg}</p> : null}
      </div>
    </Card>
  )
}
```

- [ ] **Step 2: Verify** — `pnpm test && pnpm typecheck && pnpm build` green.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: admin overview, webhook log, settings pages"`

---

### Task 9: Admin UI — Users + Plans

**Files:**
- Create: `src/components/admin/users.tsx`, `src/components/admin/plans.tsx`, `src/app/admin/users/page.tsx`, `src/app/admin/plans/page.tsx`

**Interfaces:** same client pattern. Users: search input → list → expandable detail (apps + payments) with actions Grant trial (prompt days via Input, default from settings) + Revoke (destructive ConfirmModal). Plans: table of all plans (active + inactive), toggle active (ConfirmModal when deactivating), edit sort/playStorePrice inline, create-plan form (id, appId, tier select, duration select incl lifetime, pricePaise via rupee input ×100, playStore price optional, sort).

- [ ] **Step 1: Implement**

`src/components/admin/users.tsx`:
```tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmModal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { formatINR } from '@/lib/format'
import { useAuth } from '@/lib/auth-context'
import { adminFetch } from './admin-fetch'

type UserRow = { uid: string; email: string | null; displayName: string | null; admin: boolean; createdAt: string }
type Detail = { profile: { uid: string; email: string | null; displayName: string | null } | null; apps: Array<{ appId: string; data: any }>; payments: any[] }

export function AdminUsers() {
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [users, setUsers] = useState<UserRow[] | null>(null)
  const [error, setError] = useState(false)
  const [openUid, setOpenUid] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [trialDays, setTrialDays] = useState(7)
  const [revokeTarget, setRevokeTarget] = useState<{ uid: string; appId: string } | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setError(false)
    try {
      const res = await adminFetch(user, `/api/admin/users?q=${encodeURIComponent(q)}`)
      if (!res.ok) throw new Error('failed')
      setUsers((await res.json()).users)
    } catch {
      setError(true)
    }
  }, [user, q])

  useEffect(() => {
    void load()
  }, [load])

  async function openDetail(uid: string) {
    if (!user) return
    setOpenUid(uid)
    setDetail(null)
    setActionMsg(null)
    const res = await adminFetch(user, `/api/admin/users/${uid}`)
    if (res.ok) setDetail(await res.json())
    else setActionMsg('Failed to load user detail.')
  }

  async function act(uid: string, appId: string, action: 'grant-trial' | 'revoke') {
    if (!user) return
    setActionMsg(null)
    const res = await adminFetch(user, `/api/admin/users/${uid}`, {
      method: 'POST',
      body: JSON.stringify(action === 'grant-trial' ? { action, appId, trialDays } : { action, appId }),
    })
    const data = await res.json().catch(() => ({}))
    setActionMsg(res.ok ? 'Done.' : (data.error ?? 'Action failed.'))
    if (res.ok) await openDetail(uid)
  }

  return (
    <div>
      <div className="flex items-end gap-3">
        <div className="grow">
          <Input label="Search users" placeholder="email, name, or uid" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>Search</Button>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-500">Couldn’t load users.</p>
      ) : !users ? (
        <p className="mt-4 text-sm text-muted">Loading…</p>
      ) : users.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No users found.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {users.map((u) => (
            <Card key={u.uid} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-fg">{u.displayName ?? u.email ?? u.uid}</p>
                  <p className="text-xs text-muted">{u.email} · joined {new Date(u.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {u.admin ? <Badge>admin</Badge> : null}
                  <Button variant="outline" size="sm" onClick={() => void openDetail(u.uid)}>
                    {openUid === u.uid ? 'Refresh' : 'Details'}
                  </Button>
                </div>
              </div>

              {openUid === u.uid ? (
                <div className="mt-4 border-t border-line pt-4">
                  {!detail ? (
                    <p className="text-sm text-muted">{actionMsg ?? 'Loading…'}</p>
                  ) : (
                    <>
                      {detail.apps.length === 0 ? <p className="text-sm text-muted">No app entitlements.</p> : null}
                      {detail.apps.map(({ appId, data }) => (
                        <div key={appId} className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm text-fg">
                            <span className="font-medium capitalize">{appId}</span>{' '}
                            <span className="text-muted">
                              {data.subscription
                                ? `${data.subscription.status} · ${data.subscription.tier ?? ''} · ${
                                    data.subscription.expiryTimeMillis === null
                                      ? 'lifetime'
                                      : new Date(data.subscription.expiryTimeMillis).toLocaleDateString()
                                  }`
                                : 'no subscription'}
                              {data.trialUsed ? ' · trial used' : ''}
                            </span>
                          </p>
                          <Button variant="outline" size="sm" onClick={() => setRevokeTarget({ uid: u.uid, appId })}>
                            Revoke
                          </Button>
                        </div>
                      ))}
                      <div className="mt-4 flex flex-wrap items-end gap-3">
                        <div className="w-32">
                          <Input label="Trial days" type="number" min={1} max={365} value={trialDays} onChange={(e) => setTrialDays(Number(e.target.value))} />
                        </div>
                        <Button size="sm" onClick={() => void act(u.uid, 'crackloop', 'grant-trial')}>
                          Grant trial (crackloop)
                        </Button>
                      </div>
                      {detail.payments.length > 0 ? (
                        <ul className="mt-4 space-y-1 text-xs text-muted">
                          {detail.payments.map((p) => (
                            <li key={p.id}>
                              {new Date(p.createdAt).toLocaleDateString()} · {p.appId} · {p.type} · {formatINR(p.amountPaise)}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {actionMsg ? <p role="status" className="mt-3 text-xs text-muted">{actionMsg}</p> : null}
                    </>
                  )}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <ConfirmModal
        open={revokeTarget !== null}
        title="Revoke access?"
        body="This immediately removes the user's entitlements for this app. It does not cancel Razorpay billing."
        confirmLabel="Revoke"
        destructive
        onConfirm={() => {
          if (revokeTarget) void act(revokeTarget.uid, revokeTarget.appId, 'revoke')
          setRevokeTarget(null)
        }}
        onClose={() => setRevokeTarget(null)}
      />
    </div>
  )
}
```

`src/components/admin/plans.tsx`:
```tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmModal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { formatINR } from '@/lib/format'
import { APPS } from '@/config/apps'
import { useAuth } from '@/lib/auth-context'
import { adminFetch } from './admin-fetch'

type PlanRow = {
  id: string; appId: string; tier: 'pro' | 'ai'; durationMonths: number | null; lifetime: boolean
  pricePaise: number; playStorePricePaise: number | null; active: boolean; sort: number; razorpayPlanId: string | null
}

const DURATIONS = [
  { label: '1 month', months: 1 }, { label: '3 months', months: 3 },
  { label: '6 months', months: 6 }, { label: '12 months', months: 12 },
  { label: 'Lifetime', months: null },
] as const

export function AdminPlans() {
  const { user } = useAuth()
  const [plans, setPlans] = useState<PlanRow[] | null>(null)
  const [error, setError] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [deactivate, setDeactivate] = useState<string | null>(null)
  const [form, setForm] = useState({ id: '', appId: APPS[0]?.id ?? '', tier: 'pro' as 'pro' | 'ai', duration: '1', priceRupees: '', playRupees: '', sort: '10' })
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setError(false)
    try {
      const res = await adminFetch(user, '/api/admin/plans')
      if (!res.ok) throw new Error('failed')
      setPlans((await res.json()).plans)
    } catch {
      setError(true)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  async function patch(planId: string, body: Record<string, unknown>) {
    if (!user) return
    setMsg(null)
    const res = await adminFetch(user, `/api/admin/plans/${planId}`, { method: 'PATCH', body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    setMsg(res.ok ? 'Updated.' : (data.error ?? 'Update failed.'))
    if (res.ok) await load()
  }

  async function create() {
    if (!user) return
    setCreating(true)
    setMsg(null)
    try {
      const months = form.duration === 'lifetime' ? null : Number(form.duration)
      const body = {
        id: form.id.trim(),
        appId: form.appId,
        tier: form.tier,
        durationMonths: months,
        lifetime: months === null,
        pricePaise: Math.round(Number(form.priceRupees) * 100),
        playStorePricePaise: form.playRupees ? Math.round(Number(form.playRupees) * 100) : null,
        sort: Number(form.sort),
      }
      const res = await adminFetch(user, '/api/admin/plans', { method: 'POST', body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      setMsg(res.ok ? `Created ${body.id}.` : (data.error ?? 'Create failed.'))
      if (res.ok) {
        setForm({ ...form, id: '', priceRupees: '', playRupees: '' })
        await load()
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      {msg ? <p role="status" className="mb-4 text-sm text-muted">{msg}</p> : null}

      {error ? (
        <Card>
          <p role="alert" className="text-sm text-red-500">Couldn’t load plans.</p>
          <div className="mt-4"><Button variant="outline" size="sm" onClick={() => void load()}>Retry</Button></div>
        </Card>
      ) : !plans ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="space-y-3">
          {plans.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-fg">
                    {p.id} <Badge tone={p.active ? 'success' : 'warn'}>{p.active ? 'active' : 'inactive'}</Badge>
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {p.appId} · {p.tier.toUpperCase()} · {p.lifetime ? 'Lifetime' : `${p.durationMonths}mo`} ·{' '}
                    {formatINR(p.pricePaise)}
                    {p.playStorePricePaise ? ` (Play ${formatINR(p.playStorePricePaise)})` : ''} · sort {p.sort}
                    {p.razorpayPlanId ? '' : p.lifetime ? '' : ' · NOT SEEDED'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {p.active ? (
                    <Button variant="outline" size="sm" onClick={() => setDeactivate(p.id)}>Deactivate</Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => void patch(p.id, { active: true })}>Activate</Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-8 max-w-lg">
        <h2 className="font-display text-lg font-semibold text-fg">Create plan</h2>
        <p className="mt-1 text-xs text-muted">
          Prices are immutable after creation (Razorpay). To change a price, create a new plan and deactivate the old one.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input label="Plan id (slug)" placeholder="crackloop-pro-3m" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="plan-app" className="text-sm font-medium text-fg">App</label>
            <select id="plan-app" value={form.appId} onChange={(e) => setForm({ ...form, appId: e.target.value })} className="h-10 rounded-lg border border-line bg-card px-3 text-sm text-fg">
              {APPS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="plan-tier" className="text-sm font-medium text-fg">Tier</label>
            <select id="plan-tier" value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value as 'pro' | 'ai' })} className="h-10 rounded-lg border border-line bg-card px-3 text-sm text-fg">
              <option value="pro">Pro</option>
              <option value="ai">AI</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="plan-duration" className="text-sm font-medium text-fg">Duration</label>
            <select id="plan-duration" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} className="h-10 rounded-lg border border-line bg-card px-3 text-sm text-fg">
              {DURATIONS.map((d) => <option key={d.label} value={d.months === null ? 'lifetime' : String(d.months)}>{d.label}</option>)}
            </select>
          </div>
          <Input label="Price (₹)" type="number" min={1} value={form.priceRupees} onChange={(e) => setForm({ ...form, priceRupees: e.target.value })} />
          <Input label="Play Store price (₹, optional)" type="number" value={form.playRupees} onChange={(e) => setForm({ ...form, playRupees: e.target.value })} />
          <Input label="Sort" type="number" value={form.sort} onChange={(e) => setForm({ ...form, sort: e.target.value })} />
        </div>
        <div className="mt-5">
          <Button size="sm" disabled={creating || !form.id || !form.priceRupees} onClick={() => void create()}>
            {creating ? 'Creating…' : 'Create plan'}
          </Button>
        </div>
      </Card>

      <ConfirmModal
        open={deactivate !== null}
        title="Deactivate plan?"
        body="The plan disappears from pricing and the app API. Existing subscribers are unaffected."
        confirmLabel="Deactivate"
        destructive
        onConfirm={() => {
          if (deactivate) void patch(deactivate, { active: false })
          setDeactivate(null)
        }}
        onClose={() => setDeactivate(null)}
      />
    </div>
  )
}
```

`src/app/admin/users/page.tsx` / `src/app/admin/plans/page.tsx`: 3-line server wrappers rendering `AdminUsers` / `AdminPlans`.

- [ ] **Step 2: Verify** — `pnpm test && pnpm typecheck && pnpm build` green; `/admin/*` pages listed.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: admin users and plans management pages"`

---

### Task 10: README + gate doc + verification

**Files:**
- Modify: `README.md` (add admin dashboard + trials to shipped features), `docs/BILLING-TEST-GATE.md` (append admin gate rows)

- [ ] **Step 1:** README highlights: add "- Admin dashboard (`/admin`): metrics, user management, plan CRUD, settings, webhook log — single admin via Firebase custom claim (`scripts/set-admin.mjs`)." and "- Free trials: admin-configurable, once per user per app."
- [ ] **Step 2:** Append to `docs/BILLING-TEST-GATE.md`:
```markdown

## Admin gate (after `node --env-file=.env.local scripts/set-admin.mjs <your-email>` + re-sign-in)

| # | Flow | Steps | Expect |
|---|------|-------|--------|
| A1 | Access control | open /admin signed out, as normal user, as admin | sign-in prompt / "Not authorized" / dashboard |
| A2 | Metrics | /admin after test payments | revenue matches test payments sum |
| A3 | Trial toggle | /admin/settings enable trials, save | /account (normal user) shows "Try free trial"; grant works; second request → not eligible |
| A4 | Admin trial grant | /admin/users → user → grant trial 30d | user's /account shows trial, ends in 30 days |
| A5 | Revoke | /admin/users → revoke app access | user entitlements zeroed (status revoked) |
| A6 | Plan CRUD | /admin/plans create 3m plan ₹199 | appears on /pricing + /api/v1/plans; deactivate → disappears from both |
| A7 | Webhook log | /admin/webhooks | events from earlier test payments listed |
```
- [ ] **Step 3: Verify** — `pnpm test && pnpm typecheck && pnpm build` green.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "docs: admin + trials shipped, admin manual gate"`

---

## Out of scope for Plan 3
- Influencer approval/commission/payout admin pages (Plan 4, with the influencer data model)
- Promo code admin (Plan 4)
- Multi-admin/role management (single admin by design)
- The users list Grant-trial button hardcodes `'crackloop'` (single live app); Plan 4+ can add an app selector when a second app ships
