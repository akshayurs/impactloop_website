# Rewrite Plan 2/4 — Billing (Razorpay + Firestore)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real money flow — Firestore-backed plans, Razorpay checkout (recurring subscriptions + one-time lifetime order), webhook-driven entitlements, cancel, payment history, and a public plans API for the Android app.

**Architecture:** All money paths server-side in API routes using firebase-admin + a thin Razorpay REST client (fetch + Basic auth, no npm SDK). Client touches money only through: (a) a checkout island that calls our API then opens Razorpay's modal, (b) an account view that reads its own summary via an authed API route. Firestore is server-only (client SDK does auth exclusively; rules default-deny). Webhook is HMAC-verified, idempotent, and is the single source of truth for granting entitlements on recurring payments; lifetime grants happen on server-side payment-signature verification with webhook as backup.

**Tech Stack:** Next.js 15 route handlers (nodejs runtime), firebase-admin ^13, Razorpay REST API, Vitest with vi.mock for route tests.

**Spec:** `docs/superpowers/specs/2026-07-14-website-rewrite-design.md` §3–4
**Builds on:** Plan 1 (branch `feat/rewrite-v3`) — `getPlans()` swap point in `src/config/plans.ts`, PlanCard button placeholder, AccountView subscriptions placeholder, `formatINR`, UI primitives incl. `ConfirmModal`.

## Global Constraints

- All amounts integer **paise**; display via `formatINR(paise)` only; never float math on money
- Commissions/discounts are **Plan 4** — leave no promo code logic here, but checkout request accepts an optional `promoCode` field that this plan validates as "must be absent" (rejects if present) so the API shape is stable
- Webhook: HMAC-SHA256 verified with timing-safe compare, **fail closed** (missing secret → 500, bad signature → 400, never process), idempotent via `webhookEvents/{id}` marker written AFTER effects (retry-safe)
- Entitlement writes only from webhook-confirmed payments or server-verified payment signatures — never from client claims
- `pnpm build` must succeed with NO env vars set (all server modules lazy-init; clear thrown errors at request time)
- Client bundle: no `firebase/firestore` import anywhere; no Razorpay JS in marketing pages (checkout script loads only on user click)
- Firebase custom-claims roles arrive in Plan 3; this plan's routes need only authenticated uid
- Firestore rules: default deny all client access
- Razorpay REST base `https://api.razorpay.com/v1`, Basic auth `RAZORPAY_KEY_ID:RAZORPAY_KEY_SECRET`
- Entitlement doc path `users/{uid}/apps/{appId}`; tier grants: `pro → {adFree:true, unlimitedAi:false}`, `ai → {adFree:true, unlimitedAi:true}`
- Live-subscription status allowlist (blocks duplicate checkout): `['created','authenticated','active','pending']` — `halted`/`cancelled`/unknown must NOT block re-subscribe
- Conventional Commits; commit at end of every task

## File Structure

```
src/lib/server/
  firebase-admin.ts      # lazy admin app; adminDb(), adminAuth()
  verify-token.ts        # requireUser(req) -> {uid, email} | throws UnauthorizedError
  razorpay.ts            # REST client + signature verifiers
  entitlements.ts        # tier grants, entitlement doc builders + writers
  webhook-events.ts      # pure event -> effect mapping
  plans-store.ts         # getPlansFromDb(appId) with static fallback
src/app/api/
  checkout/route.ts            # POST: create subscription or lifetime order
  checkout/verify/route.ts     # POST: lifetime payment signature verify + grant
  razorpay/webhook/route.ts    # POST: webhook
  subscription/cancel/route.ts # POST: cancel at cycle end
  me/summary/route.ts          # GET: own subscriptions + payments
  v1/plans/route.ts            # GET: public plans for Android app
src/components/checkout-button.tsx  # client island on PlanCard
src/app/account/account-view.tsx    # extend: subscriptions, payments, cancel
scripts/seed-plans.mjs              # idempotent: razorpay plans + firestore docs
firestore.rules                     # default deny
```

---

### Task 1: firebase-admin lazy init + requireUser

**Files:**
- Create: `src/lib/server/firebase-admin.ts`, `src/lib/server/verify-token.ts`, `src/lib/server/verify-token.test.ts`
- Modify: `package.json` (add `firebase-admin`), `.env.local.example`

**Interfaces:**
- Produces: `adminDb(): Firestore`, `adminAuth(): Auth` — lazy, throw `new Error('FIREBASE_SERVICE_ACCOUNT env missing')` when creds absent at CALL time (never import time). `requireUser(req: Request): Promise<{ uid: string; email: string | null }>` — reads `Authorization: Bearer <idToken>`, throws `UnauthorizedError` (exported class, `status = 401`) on missing/invalid.

- [ ] **Step 1: Install dep**

```bash
pnpm add firebase-admin@^13
```

Add to `.env.local.example`:
```
# Server (billing)
FIREBASE_SERVICE_ACCOUNT=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

- [ ] **Step 2: Failing test**

`src/lib/server/verify-token.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const verifyIdToken = vi.fn()
vi.mock('./firebase-admin', () => ({
  adminAuth: () => ({ verifyIdToken }),
}))

import { requireUser, UnauthorizedError } from './verify-token'

describe('requireUser', () => {
  beforeEach(() => verifyIdToken.mockReset())

  it('rejects missing Authorization header', async () => {
    const req = new Request('http://x', { method: 'POST' })
    await expect(requireUser(req)).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('rejects non-Bearer header', async () => {
    const req = new Request('http://x', { headers: { Authorization: 'Basic abc' } })
    await expect(requireUser(req)).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('rejects when token verification fails', async () => {
    verifyIdToken.mockRejectedValue(new Error('bad token'))
    const req = new Request('http://x', { headers: { Authorization: 'Bearer tok' } })
    await expect(requireUser(req)).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('returns uid and email on valid token', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.c' })
    const req = new Request('http://x', { headers: { Authorization: 'Bearer tok' } })
    await expect(requireUser(req)).resolves.toEqual({ uid: 'u1', email: 'a@b.c' })
  })

  it('normalizes missing email to null', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1' })
    const req = new Request('http://x', { headers: { Authorization: 'Bearer tok' } })
    await expect(requireUser(req)).resolves.toEqual({ uid: 'u1', email: null })
  })
})
```

Run: `pnpm test -- src/lib/server/verify-token.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

`src/lib/server/firebase-admin.ts`:
```ts
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

function app(): App {
  const existing = getApps()[0]
  if (existing) return existing
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env missing')
  return initializeApp({ credential: cert(JSON.parse(raw)) })
}

export function adminDb(): Firestore {
  return getFirestore(app())
}

export function adminAuth(): Auth {
  return getAuth(app())
}
```

`src/lib/server/verify-token.ts`:
```ts
import { adminAuth } from './firebase-admin'

export class UnauthorizedError extends Error {
  status = 401
}

export async function requireUser(req: Request): Promise<{ uid: string; email: string | null }> {
  const header = req.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) throw new UnauthorizedError('missing bearer token')
  const token = header.slice('Bearer '.length)
  try {
    const decoded = await adminAuth().verifyIdToken(token)
    return { uid: decoded.uid, email: decoded.email ?? null }
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err
    throw new UnauthorizedError('invalid token')
  }
}
```

- [ ] **Step 4: Verify** — `pnpm test` PASS (5 new), `pnpm typecheck` clean, `pnpm build` succeeds with no env vars.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: firebase-admin lazy init and bearer-token auth"`

---

### Task 2: Razorpay REST client + signature verifiers

**Files:**
- Create: `src/lib/server/razorpay.ts`, `src/lib/server/razorpay.test.ts`

**Interfaces:**
- Produces:
  - `rzpFetch(path: string, init?: RequestInit): Promise<any>` — internal helper, Basic auth, throws `RazorpayError` (exported, carries `status`) on non-2xx with Razorpay's error description
  - `createSubscription(input: { razorpayPlanId: string; totalCount: number; notes: Record<string, string> }): Promise<{ id: string; status: string }>`
  - `createOrder(input: { amountPaise: number; receipt: string; notes: Record<string, string> }): Promise<{ id: string; amount: number }>`
  - `cancelSubscriptionAtCycleEnd(subscriptionId: string): Promise<{ id: string; status: string }>`
  - `verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean` — HMAC-SHA256 hex, timing-safe, length-guarded
  - `verifyPaymentSignature(input: { orderId: string; paymentId: string; signature: string }, secret: string): boolean` — HMAC-SHA256 of `` `${orderId}|${paymentId}` ``, timing-safe

- [ ] **Step 1: Failing tests**

`src/lib/server/razorpay.test.ts`:
```ts
import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createOrder,
  createSubscription,
  cancelSubscriptionAtCycleEnd,
  RazorpayError,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from './razorpay'

const SECRET = 'whsec_test'
function sign(body: string, secret = SECRET) {
  return createHmac('sha256', secret).update(body).digest('hex')
}

describe('verifyWebhookSignature', () => {
  it('accepts a valid signature', () => {
    const body = '{"event":"subscription.charged"}'
    expect(verifyWebhookSignature(body, sign(body), SECRET)).toBe(true)
  })
  it('rejects a tampered body', () => {
    expect(verifyWebhookSignature('{"event":"x"}', sign('{"event":"y"}'), SECRET)).toBe(false)
  })
  it('rejects wrong-length signature without throwing', () => {
    expect(verifyWebhookSignature('body', 'deadbeef', SECRET)).toBe(false)
  })
})

describe('verifyPaymentSignature', () => {
  it('accepts valid order|payment signature', () => {
    const sig = sign('order_1|pay_1', 'keysecret')
    expect(verifyPaymentSignature({ orderId: 'order_1', paymentId: 'pay_1', signature: sig }, 'keysecret')).toBe(true)
  })
  it('rejects mismatched payment id', () => {
    const sig = sign('order_1|pay_1', 'keysecret')
    expect(verifyPaymentSignature({ orderId: 'order_1', paymentId: 'pay_2', signature: sig }, 'keysecret')).toBe(false)
  })
})

describe('REST client', () => {
  beforeEach(() => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_key'
    process.env.RAZORPAY_KEY_SECRET = 'secret'
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.RAZORPAY_KEY_ID
    delete process.env.RAZORPAY_KEY_SECRET
  })

  it('createSubscription posts plan and count with basic auth', async () => {
    ;(fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ id: 'sub_1', status: 'created' }), { status: 200 }),
    )
    const res = await createSubscription({ razorpayPlanId: 'plan_x', totalCount: 12, notes: { uid: 'u1' } })
    expect(res).toEqual({ id: 'sub_1', status: 'created' })
    const [url, init] = (fetch as any).mock.calls[0]
    expect(url).toBe('https://api.razorpay.com/v1/subscriptions')
    expect(init.headers.Authorization).toBe('Basic ' + Buffer.from('rzp_test_key:secret').toString('base64'))
    expect(JSON.parse(init.body)).toMatchObject({ plan_id: 'plan_x', total_count: 12, customer_notify: 1 })
  })

  it('createOrder posts integer paise amount', async () => {
    ;(fetch as any).mockResolvedValue(new Response(JSON.stringify({ id: 'order_1', amount: 199900 }), { status: 200 }))
    const res = await createOrder({ amountPaise: 199900, receipt: 'r1', notes: {} })
    expect(res).toEqual({ id: 'order_1', amount: 199900 })
    const [, init] = (fetch as any).mock.calls[0]
    expect(JSON.parse(init.body)).toMatchObject({ amount: 199900, currency: 'INR', receipt: 'r1' })
  })

  it('cancel hits cancel endpoint with cycle-end flag', async () => {
    ;(fetch as any).mockResolvedValue(new Response(JSON.stringify({ id: 'sub_1', status: 'cancelled' }), { status: 200 }))
    await cancelSubscriptionAtCycleEnd('sub_1')
    const [url, init] = (fetch as any).mock.calls[0]
    expect(url).toBe('https://api.razorpay.com/v1/subscriptions/sub_1/cancel')
    expect(JSON.parse(init.body)).toEqual({ cancel_at_cycle_end: 1 })
  })

  it('throws RazorpayError with description on non-2xx', async () => {
    ;(fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ error: { description: 'Bad plan id' } }), { status: 400 }),
    )
    await expect(createSubscription({ razorpayPlanId: 'x', totalCount: 1, notes: {} })).rejects.toMatchObject({
      status: 400,
      message: 'Bad plan id',
    })
  })

  it('throws when keys missing', async () => {
    delete process.env.RAZORPAY_KEY_ID
    await expect(createOrder({ amountPaise: 1, receipt: 'r', notes: {} })).rejects.toThrow(/RAZORPAY_KEY_ID/)
  })
})
```

Run: `pnpm test -- src/lib/server/razorpay.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implement**

`src/lib/server/razorpay.ts`:
```ts
import { createHmac, timingSafeEqual } from 'node:crypto'

const BASE = 'https://api.razorpay.com/v1'

export class RazorpayError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

function authHeader(): string {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId) throw new Error('RAZORPAY_KEY_ID env missing')
  if (!keySecret) throw new Error('RAZORPAY_KEY_SECRET env missing')
  return 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64')
}

async function rzpFetch(path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new RazorpayError(json?.error?.description ?? `razorpay ${res.status}`, res.status)
  }
  return json
}

export async function createSubscription(input: {
  razorpayPlanId: string
  totalCount: number
  notes: Record<string, string>
}): Promise<{ id: string; status: string }> {
  const json = await rzpFetch('/subscriptions', {
    plan_id: input.razorpayPlanId,
    total_count: input.totalCount,
    customer_notify: 1,
    notes: input.notes,
  })
  return { id: json.id, status: json.status }
}

export async function createOrder(input: {
  amountPaise: number
  receipt: string
  notes: Record<string, string>
}): Promise<{ id: string; amount: number }> {
  const json = await rzpFetch('/orders', {
    amount: input.amountPaise,
    currency: 'INR',
    receipt: input.receipt,
    notes: input.notes,
  })
  return { id: json.id, amount: json.amount }
}

export async function cancelSubscriptionAtCycleEnd(subscriptionId: string): Promise<{ id: string; status: string }> {
  const json = await rzpFetch(`/subscriptions/${subscriptionId}/cancel`, { cancel_at_cycle_end: 1 })
  return { id: json.id, status: json.status }
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  return safeEqualHex(expected, signature)
}

export function verifyPaymentSignature(
  input: { orderId: string; paymentId: string; signature: string },
  secret: string,
): boolean {
  const expected = createHmac('sha256', secret).update(`${input.orderId}|${input.paymentId}`).digest('hex')
  return safeEqualHex(expected, input.signature)
}
```

- [ ] **Step 3: Verify** — `pnpm test` PASS (11 new), typecheck clean.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: razorpay rest client and timing-safe signature verification"`

---

### Task 3: Entitlements module

**Files:**
- Create: `src/lib/server/entitlements.ts`, `src/lib/server/entitlements.test.ts`

**Interfaces:**
- Consumes: `Plan` type from `@/config/plans`, `adminDb` from `./firebase-admin`.
- Produces:
  - `grantsForTier(tier: 'pro' | 'ai'): { adFree: boolean; unlimitedAi: boolean }`
  - `type EntitlementDoc = { subscription: { status: string; planId: string; tier: 'pro' | 'ai'; expiryTimeMillis: number | null; autoRenewing: boolean; razorpaySubscriptionId: string | null; source: 'web'; lastVerifiedAt: number }; entitlements: { adFree: boolean; unlimitedAi: boolean } }`
  - `buildSubscriptionEntitlement(input: { plan: Plan; status: string; currentEndMillis: number; razorpaySubscriptionId: string; nowMillis: number }): EntitlementDoc` — active statuses grant tier entitlements; non-active grant `{adFree:false, unlimitedAi:false}`
  - `buildLifetimeEntitlement(input: { plan: Plan; nowMillis: number }): EntitlementDoc` — `status:'lifetime'`, `expiryTimeMillis: null`, `autoRenewing:false`, full tier grants
  - `writeEntitlement(uid: string, appId: string, doc: EntitlementDoc): Promise<void>` — merge-set to `users/{uid}/apps/{appId}`
  - `ACTIVE_SUB_STATUSES = ['created','authenticated','active','pending'] as const` and `isLiveStatus(s: string): boolean` (allowlist)

- [ ] **Step 1: Failing tests**

`src/lib/server/entitlements.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'

const set = vi.fn()
vi.mock('./firebase-admin', () => ({
  adminDb: () => ({ doc: (path: string) => ({ set: (data: unknown, opts: unknown) => set(path, data, opts) }) }),
}))

import type { Plan } from '@/config/plans'
import {
  ACTIVE_SUB_STATUSES,
  buildLifetimeEntitlement,
  buildSubscriptionEntitlement,
  grantsForTier,
  isLiveStatus,
  writeEntitlement,
} from './entitlements'

const proPlan: Plan = {
  id: 'crackloop-pro-1m', appId: 'crackloop', tier: 'pro', durationMonths: 1, lifetime: false,
  pricePaise: 7900, playStorePricePaise: 9900, active: true, sort: 1,
}
const aiPlan: Plan = { ...proPlan, id: 'crackloop-ai-1m', tier: 'ai' }
const lifetimePlan: Plan = { ...proPlan, id: 'crackloop-pro-life', durationMonths: null, lifetime: true, playStorePricePaise: null }

describe('grantsForTier', () => {
  it('pro: adFree only; ai: both', () => {
    expect(grantsForTier('pro')).toEqual({ adFree: true, unlimitedAi: false })
    expect(grantsForTier('ai')).toEqual({ adFree: true, unlimitedAi: true })
  })
})

describe('isLiveStatus allowlist', () => {
  it('allows only the four live statuses', () => {
    expect([...ACTIVE_SUB_STATUSES]).toEqual(['created', 'authenticated', 'active', 'pending'])
    expect(isLiveStatus('active')).toBe(true)
    expect(isLiveStatus('halted')).toBe(false)
    expect(isLiveStatus('cancelled')).toBe(false)
    expect(isLiveStatus('garbage')).toBe(false)
  })
})

describe('buildSubscriptionEntitlement', () => {
  it('active status grants tier entitlements with expiry', () => {
    const doc = buildSubscriptionEntitlement({
      plan: aiPlan, status: 'active', currentEndMillis: 1750000000000, razorpaySubscriptionId: 'sub_1', nowMillis: 1749000000000,
    })
    expect(doc.subscription).toMatchObject({
      status: 'active', planId: 'crackloop-ai-1m', tier: 'ai', expiryTimeMillis: 1750000000000,
      autoRenewing: true, razorpaySubscriptionId: 'sub_1', source: 'web', lastVerifiedAt: 1749000000000,
    })
    expect(doc.entitlements).toEqual({ adFree: true, unlimitedAi: true })
  })
  it('non-live status revokes grants but keeps record', () => {
    const doc = buildSubscriptionEntitlement({
      plan: proPlan, status: 'halted', currentEndMillis: 1750000000000, razorpaySubscriptionId: 'sub_1', nowMillis: 1749000000000,
    })
    expect(doc.entitlements).toEqual({ adFree: false, unlimitedAi: false })
    expect(doc.subscription.autoRenewing).toBe(false)
  })
})

describe('buildLifetimeEntitlement', () => {
  it('grants forever with null expiry', () => {
    const doc = buildLifetimeEntitlement({ plan: lifetimePlan, nowMillis: 1749000000000 })
    expect(doc.subscription).toMatchObject({ status: 'lifetime', expiryTimeMillis: null, autoRenewing: false, razorpaySubscriptionId: null })
    expect(doc.entitlements).toEqual({ adFree: true, unlimitedAi: false })
  })
})

describe('writeEntitlement', () => {
  it('merge-sets to users/{uid}/apps/{appId}', async () => {
    const doc = buildLifetimeEntitlement({ plan: lifetimePlan, nowMillis: 1 })
    await writeEntitlement('u1', 'crackloop', doc)
    expect(set).toHaveBeenCalledWith('users/u1/apps/crackloop', doc, { merge: true })
  })
})
```

Run — Expected: FAIL.

- [ ] **Step 2: Implement**

`src/lib/server/entitlements.ts`:
```ts
import type { Plan } from '@/config/plans'
import { adminDb } from './firebase-admin'

export const ACTIVE_SUB_STATUSES = ['created', 'authenticated', 'active', 'pending'] as const

export function isLiveStatus(status: string): boolean {
  return (ACTIVE_SUB_STATUSES as readonly string[]).includes(status)
}

export function grantsForTier(tier: 'pro' | 'ai'): { adFree: boolean; unlimitedAi: boolean } {
  return tier === 'ai' ? { adFree: true, unlimitedAi: true } : { adFree: true, unlimitedAi: false }
}

export type EntitlementDoc = {
  subscription: {
    status: string
    planId: string
    tier: 'pro' | 'ai'
    expiryTimeMillis: number | null
    autoRenewing: boolean
    razorpaySubscriptionId: string | null
    source: 'web'
    lastVerifiedAt: number
  }
  entitlements: { adFree: boolean; unlimitedAi: boolean }
}

export function buildSubscriptionEntitlement(input: {
  plan: Plan
  status: string
  currentEndMillis: number
  razorpaySubscriptionId: string
  nowMillis: number
}): EntitlementDoc {
  const live = isLiveStatus(input.status)
  return {
    subscription: {
      status: input.status,
      planId: input.plan.id,
      tier: input.plan.tier,
      expiryTimeMillis: input.currentEndMillis,
      autoRenewing: live,
      razorpaySubscriptionId: input.razorpaySubscriptionId,
      source: 'web',
      lastVerifiedAt: input.nowMillis,
    },
    entitlements: live ? grantsForTier(input.plan.tier) : { adFree: false, unlimitedAi: false },
  }
}

export function buildLifetimeEntitlement(input: { plan: Plan; nowMillis: number }): EntitlementDoc {
  return {
    subscription: {
      status: 'lifetime',
      planId: input.plan.id,
      tier: input.plan.tier,
      expiryTimeMillis: null,
      autoRenewing: false,
      razorpaySubscriptionId: null,
      source: 'web',
      lastVerifiedAt: input.nowMillis,
    },
    entitlements: grantsForTier(input.plan.tier),
  }
}

export async function writeEntitlement(uid: string, appId: string, doc: EntitlementDoc): Promise<void> {
  await adminDb().doc(`users/${uid}/apps/${appId}`).set(doc, { merge: true })
}
```

- [ ] **Step 3: Verify** — `pnpm test` PASS, typecheck clean.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: entitlement builders, tier grants, live-status allowlist"`

---

### Task 4: Webhook event mapping (pure)

**Files:**
- Create: `src/lib/server/webhook-events.ts`, `src/lib/server/webhook-events.test.ts`

**Interfaces:**
- Produces:
  - `type WebhookEffect = { kind: 'subscription-update'; subscriptionId: string; status: string; currentEndMillis: number; paymentId: string | null; amountPaise: number | null } | { kind: 'order-paid'; orderId: string; paymentId: string; amountPaise: number } | { kind: 'ignore'; reason: string }`
  - `mapWebhookEvent(body: any): WebhookEffect` — pure; handles `subscription.activated|charged|cancelled|completed|halted|paused|resumed` → subscription-update (status from payload; `charged` carries payment entity), `order.paid` → order-paid, everything else → ignore
  - `idempotencyKeyFor(body: any, headerEventId: string | null): string` — prefers `x-razorpay-event-id` header; falls back to `` `${event}:${subscriptionOrOrderId}:${current_end ?? payment_id ?? ''}` ``

- [ ] **Step 1: Failing tests**

`src/lib/server/webhook-events.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { idempotencyKeyFor, mapWebhookEvent } from './webhook-events'

function subEvent(event: string, overrides: any = {}) {
  return {
    event,
    payload: {
      subscription: { entity: { id: 'sub_1', status: overrides.status ?? 'active', current_end: 1750000000, ...overrides.sub } },
      ...(overrides.payment ? { payment: { entity: { id: 'pay_1', amount: 7900, ...overrides.payment } } } : {}),
    },
  }
}

describe('mapWebhookEvent', () => {
  it('subscription.activated -> subscription-update without payment', () => {
    expect(mapWebhookEvent(subEvent('subscription.activated'))).toEqual({
      kind: 'subscription-update', subscriptionId: 'sub_1', status: 'active',
      currentEndMillis: 1750000000000, paymentId: null, amountPaise: null,
    })
  })
  it('subscription.charged carries payment id and amount', () => {
    expect(mapWebhookEvent(subEvent('subscription.charged', { payment: {} }))).toEqual({
      kind: 'subscription-update', subscriptionId: 'sub_1', status: 'active',
      currentEndMillis: 1750000000000, paymentId: 'pay_1', amountPaise: 7900,
    })
  })
  it('subscription.halted maps status verbatim', () => {
    const effect = mapWebhookEvent(subEvent('subscription.halted', { status: 'halted' }))
    expect(effect).toMatchObject({ kind: 'subscription-update', status: 'halted' })
  })
  it('order.paid -> order-paid', () => {
    const body = { event: 'order.paid', payload: { order: { entity: { id: 'order_1' } }, payment: { entity: { id: 'pay_9', amount: 199900 } } } }
    expect(mapWebhookEvent(body)).toEqual({ kind: 'order-paid', orderId: 'order_1', paymentId: 'pay_9', amountPaise: 199900 })
  })
  it('unknown events are ignored with reason', () => {
    expect(mapWebhookEvent({ event: 'refund.processed', payload: {} })).toEqual({ kind: 'ignore', reason: 'unhandled event refund.processed' })
  })
  it('malformed subscription payload is ignored, not thrown', () => {
    expect(mapWebhookEvent({ event: 'subscription.charged', payload: {} })).toMatchObject({ kind: 'ignore' })
  })
})

describe('idempotencyKeyFor', () => {
  it('prefers header event id', () => {
    expect(idempotencyKeyFor(subEvent('subscription.charged'), 'evt_123')).toBe('evt_123')
  })
  it('falls back to composite key', () => {
    expect(idempotencyKeyFor(subEvent('subscription.charged'), null)).toBe('subscription.charged:sub_1:1750000000')
  })
})
```

Run — Expected: FAIL.

- [ ] **Step 2: Implement**

`src/lib/server/webhook-events.ts`:
```ts
export type WebhookEffect =
  | {
      kind: 'subscription-update'
      subscriptionId: string
      status: string
      currentEndMillis: number
      paymentId: string | null
      amountPaise: number | null
    }
  | { kind: 'order-paid'; orderId: string; paymentId: string; amountPaise: number }
  | { kind: 'ignore'; reason: string }

const SUBSCRIPTION_EVENTS = new Set([
  'subscription.activated',
  'subscription.charged',
  'subscription.cancelled',
  'subscription.completed',
  'subscription.halted',
  'subscription.paused',
  'subscription.resumed',
])

export function mapWebhookEvent(body: any): WebhookEffect {
  const event = body?.event
  if (SUBSCRIPTION_EVENTS.has(event)) {
    const sub = body?.payload?.subscription?.entity
    if (!sub?.id || typeof sub.current_end !== 'number') {
      return { kind: 'ignore', reason: `malformed subscription payload for ${event}` }
    }
    const payment = body?.payload?.payment?.entity
    return {
      kind: 'subscription-update',
      subscriptionId: sub.id,
      status: String(sub.status),
      currentEndMillis: sub.current_end * 1000,
      paymentId: payment?.id ?? null,
      amountPaise: typeof payment?.amount === 'number' ? payment.amount : null,
    }
  }
  if (event === 'order.paid') {
    const order = body?.payload?.order?.entity
    const payment = body?.payload?.payment?.entity
    if (!order?.id || !payment?.id || typeof payment.amount !== 'number') {
      return { kind: 'ignore', reason: 'malformed order.paid payload' }
    }
    return { kind: 'order-paid', orderId: order.id, paymentId: payment.id, amountPaise: payment.amount }
  }
  return { kind: 'ignore', reason: `unhandled event ${event}` }
}

export function idempotencyKeyFor(body: any, headerEventId: string | null): string {
  if (headerEventId) return headerEventId
  const event = body?.event ?? 'unknown'
  const sub = body?.payload?.subscription?.entity
  const order = body?.payload?.order?.entity
  const entityId = sub?.id ?? order?.id ?? 'none'
  const suffix = sub?.current_end ?? body?.payload?.payment?.entity?.id ?? ''
  return `${event}:${entityId}:${suffix}`
}
```

- [ ] **Step 3: Verify** — `pnpm test` PASS, typecheck clean.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: pure webhook event mapping with idempotency keys"`

---

### Task 5: Firestore-backed plans + seed script

**Files:**
- Create: `src/lib/server/plans-store.ts`, `src/lib/server/plans-store.test.ts`, `scripts/seed-plans.mjs`
- Modify: `src/config/plans.ts` (getPlans delegates when creds exist), `src/app/pricing/page.tsx` (add `export const revalidate = 300`)

**Interfaces:**
- Consumes: `Plan`, `STATIC_PLANS` (export it from `src/config/plans.ts`), `adminDb`.
- Produces:
  - `src/config/plans.ts` additionally exports `type StoredPlan = Plan & { razorpayPlanId: string | null }`
  - `getPlansFromDb(appId: string): Promise<StoredPlan[]>` in plans-store — reads `plans` collection where `appId ==`, `active ==` true, ordered by `sort`; **falls back to `STATIC_PLANS` (razorpayPlanId: null) when `FIREBASE_SERVICE_ACCOUNT` is unset OR the query throws** (build/dev without creds must keep working)
  - `getPlanById(planId: string): Promise<StoredPlan | null>` — same fallback behavior
  - `src/config/plans.ts` `getPlans(appId)` now calls `getPlansFromDb` (server-only import via dynamic `import()` inside the function so client bundles never pull firebase-admin)

- [ ] **Step 1: Failing tests**

`src/lib/server/plans-store.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()
vi.mock('./firebase-admin', () => ({
  adminDb: () => ({
    collection: () => ({ where: () => ({ where: () => ({ orderBy: () => ({ get }) }) }) }),
    doc: (path: string) => ({ get: () => get(path) }),
  }),
}))

import { getPlanById, getPlansFromDb } from './plans-store'

describe('plans-store fallback', () => {
  afterEach(() => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT
    get.mockReset()
  })

  it('returns static plans with null razorpayPlanId when creds missing', async () => {
    const plans = await getPlansFromDb('crackloop')
    expect(plans.length).toBeGreaterThan(0)
    expect(plans.every((p) => p.razorpayPlanId === null)).toBe(true)
  })

  it('returns firestore plans when creds present', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = '{}'
    get.mockResolvedValue({
      docs: [{ data: () => ({ id: 'p1', appId: 'crackloop', tier: 'pro', durationMonths: 1, lifetime: false, pricePaise: 7900, playStorePricePaise: 9900, active: true, sort: 1, razorpayPlanId: 'plan_x' }) }],
    })
    const plans = await getPlansFromDb('crackloop')
    expect(plans).toHaveLength(1)
    expect(plans[0].razorpayPlanId).toBe('plan_x')
  })

  it('falls back to static when query throws', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = '{}'
    get.mockRejectedValue(new Error('firestore down'))
    const plans = await getPlansFromDb('crackloop')
    expect(plans.every((p) => p.razorpayPlanId === null)).toBe(true)
  })

  it('getPlanById finds static plan without creds', async () => {
    const plan = await getPlanById('crackloop-pro-1m')
    expect(plan?.appId).toBe('crackloop')
    expect(await getPlanById('nope')).toBeNull()
  })
})
```

Run — Expected: FAIL.

- [ ] **Step 2: Implement**

In `src/config/plans.ts`: export `STATIC_PLANS`, add `StoredPlan` type, and change `getPlans`:
```ts
export type StoredPlan = Plan & { razorpayPlanId: string | null }

export async function getPlans(appId: string): Promise<Plan[]> {
  if (typeof window !== 'undefined') {
    throw new Error('getPlans is server-only')
  }
  const { getPlansFromDb } = await import('@/lib/server/plans-store')
  return getPlansFromDb(appId)
}
```

`src/lib/server/plans-store.ts`:
```ts
import { STATIC_PLANS, type StoredPlan } from '@/config/plans'
import { adminDb } from './firebase-admin'

function staticFallback(appId?: string): StoredPlan[] {
  return STATIC_PLANS.filter((p) => (appId ? p.appId === appId : true) && p.active)
    .sort((a, b) => a.sort - b.sort)
    .map((p) => ({ ...p, razorpayPlanId: null }))
}

export async function getPlansFromDb(appId: string): Promise<StoredPlan[]> {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return staticFallback(appId)
  try {
    const snap = await adminDb()
      .collection('plans')
      .where('appId', '==', appId)
      .where('active', '==', true)
      .orderBy('sort')
      .get()
    return snap.docs.map((d) => d.data() as StoredPlan)
  } catch (err) {
    console.error('plans query failed, using static fallback', err)
    return staticFallback(appId)
  }
}

export async function getPlanById(planId: string): Promise<StoredPlan | null> {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    return staticFallback().find((p) => p.id === planId) ?? null
  }
  try {
    const snap = await adminDb().doc(`plans/${planId}`).get()
    return snap.exists ? (snap.data() as StoredPlan) : null
  } catch (err) {
    console.error('plan lookup failed, using static fallback', err)
    return staticFallback().find((p) => p.id === planId) ?? null
  }
}
```

In `src/app/pricing/page.tsx` add below imports:
```ts
export const revalidate = 300
```

- [ ] **Step 3: Seed script**

`scripts/seed-plans.mjs` (run manually with real env; idempotent — skips plans already having a razorpayPlanId in Firestore):
```js
// Usage: node --env-file=.env.local scripts/seed-plans.mjs
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const STATIC_PLANS = [
  { id: 'crackloop-pro-1m', appId: 'crackloop', tier: 'pro', durationMonths: 1, lifetime: false, pricePaise: 7900, playStorePricePaise: 9900, active: true, sort: 1 },
  { id: 'crackloop-pro-12m', appId: 'crackloop', tier: 'pro', durationMonths: 12, lifetime: false, pricePaise: 79900, playStorePricePaise: 99900, active: true, sort: 2 },
  { id: 'crackloop-pro-life', appId: 'crackloop', tier: 'pro', durationMonths: null, lifetime: true, pricePaise: 199900, playStorePricePaise: null, active: true, sort: 3 },
  { id: 'crackloop-ai-1m', appId: 'crackloop', tier: 'ai', durationMonths: 1, lifetime: false, pricePaise: 15900, playStorePricePaise: 19900, active: true, sort: 4 },
]

const auth = 'Basic ' + Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')

async function createRazorpayPlan(plan) {
  const res = await fetch('https://api.razorpay.com/v1/plans', {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      period: 'monthly',
      interval: plan.durationMonths,
      item: { name: `${plan.appId} ${plan.tier} ${plan.durationMonths}m`, amount: plan.pricePaise, currency: 'INR' },
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`razorpay plan create failed: ${JSON.stringify(json)}`)
  return json.id
}

const app = initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) })
const db = getFirestore(app)

for (const plan of STATIC_PLANS) {
  const ref = db.doc(`plans/${plan.id}`)
  const existing = await ref.get()
  if (existing.exists && existing.data().razorpayPlanId) {
    console.log(`skip ${plan.id} (already seeded: ${existing.data().razorpayPlanId})`)
    continue
  }
  const razorpayPlanId = plan.lifetime ? null : await createRazorpayPlan(plan)
  await ref.set({ ...plan, razorpayPlanId }, { merge: true })
  console.log(`seeded ${plan.id} -> ${razorpayPlanId ?? 'lifetime (no rzp plan)'}`)
}
console.log('done')
```

- [ ] **Step 4: Migrate existing plans.test.ts**

The Plan-1 test `src/config/plans.test.ts` calls `getPlans()` directly — in jsdom `typeof window !== 'undefined'` is TRUE, so the new guard would throw. Update that file: replace `import { getPlans } from './plans'` with `import { getPlansFromDb as getPlans } from '@/lib/server/plans-store'` and keep every assertion unchanged (the fallback path returns the same static data; the extra `razorpayPlanId: null` field doesn't affect existing assertions).

- [ ] **Step 5: Verify** — `pnpm test` PASS (all suites incl. migrated plans.test.ts), `pnpm typecheck`, `pnpm build` without env (pricing prerenders on static fallback).
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: firestore-backed plans with static fallback and seed script"`

---

### Task 6: POST /api/checkout

**Files:**
- Create: `src/app/api/checkout/route.ts`, `src/app/api/checkout/route.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `UnauthorizedError`, `getPlanById`, `isLiveStatus`, `createSubscription`, `createOrder`, `RazorpayError`, `adminDb`.
- Produces: `POST /api/checkout` — body `{ planId: string, promoCode?: string }`, auth Bearer.
  - Responses: recurring → `200 {mode:'subscription', subscriptionId, keyId}`; lifetime → `200 {mode:'order', orderId, amountPaise, keyId}`; `400` invalid planId/promoCode present; `401` unauth; `409` already live subscription for that app; `500` on Razorpay/env failure (message logged, generic body).
  - Side effects: recurring writes `razorpaySubscriptions/{subId} = {uid, appId, planId, createdAt}`; lifetime writes `orders/{orderId} = {uid, appId, planId, amountPaise, status:'created', createdAt}`.
  - `totalCount` for recurring = `Math.ceil(120 / plan.durationMonths)` (≈10 years of cycles).

- [ ] **Step 1: Failing tests**

`src/app/api/checkout/route.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireUser = vi.fn()
const getPlanById = vi.fn()
const createSubscription = vi.fn()
const createOrder = vi.fn()
const entitlementGet = vi.fn()
const docSet = vi.fn()

vi.mock('@/lib/server/verify-token', () => ({
  requireUser,
  UnauthorizedError: class extends Error { status = 401 },
}))
vi.mock('@/lib/server/plans-store', () => ({ getPlanById }))
vi.mock('@/lib/server/razorpay', () => ({
  createSubscription,
  createOrder,
  RazorpayError: class extends Error { constructor(m: string, public status: number) { super(m) } },
}))
vi.mock('@/lib/server/firebase-admin', () => ({
  adminDb: () => ({
    doc: (path: string) => ({
      get: () => entitlementGet(path),
      set: (data: unknown) => docSet(path, data),
    }),
  }),
}))

import { POST } from './route'

const PLAN = { id: 'crackloop-pro-1m', appId: 'crackloop', tier: 'pro', durationMonths: 1, lifetime: false, pricePaise: 7900, playStorePricePaise: 9900, active: true, sort: 1, razorpayPlanId: 'plan_x' }

function req(body: unknown) {
  return new Request('http://x/api/checkout', { method: 'POST', body: JSON.stringify(body), headers: { Authorization: 'Bearer t' } })
}

describe('POST /api/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RAZORPAY_KEY_ID = 'rzp_test_key'
    requireUser.mockResolvedValue({ uid: 'u1', email: 'a@b.c' })
    entitlementGet.mockResolvedValue({ exists: false, data: () => undefined })
  })

  it('401 when unauthenticated', async () => {
    const { UnauthorizedError } = await import('@/lib/server/verify-token')
    requireUser.mockRejectedValue(new UnauthorizedError('no'))
    expect((await POST(req({ planId: 'p' }))).status).toBe(401)
  })

  it('400 on unknown plan', async () => {
    getPlanById.mockResolvedValue(null)
    expect((await POST(req({ planId: 'nope' }))).status).toBe(400)
  })

  it('400 when promoCode present (plan 4 feature)', async () => {
    getPlanById.mockResolvedValue(PLAN)
    expect((await POST(req({ planId: PLAN.id, promoCode: 'X' }))).status).toBe(400)
  })

  it('409 when live subscription exists for app', async () => {
    getPlanById.mockResolvedValue(PLAN)
    entitlementGet.mockResolvedValue({ exists: true, data: () => ({ subscription: { status: 'active' } }) })
    expect((await POST(req({ planId: PLAN.id }))).status).toBe(409)
  })

  it('halted subscription does NOT block re-subscribe', async () => {
    getPlanById.mockResolvedValue(PLAN)
    entitlementGet.mockResolvedValue({ exists: true, data: () => ({ subscription: { status: 'halted' } }) })
    createSubscription.mockResolvedValue({ id: 'sub_9', status: 'created' })
    expect((await POST(req({ planId: PLAN.id }))).status).toBe(200)
  })

  it('recurring: creates subscription, writes index, returns keyId', async () => {
    getPlanById.mockResolvedValue(PLAN)
    createSubscription.mockResolvedValue({ id: 'sub_9', status: 'created' })
    const res = await POST(req({ planId: PLAN.id }))
    expect(await res.json()).toEqual({ mode: 'subscription', subscriptionId: 'sub_9', keyId: 'rzp_test_key' })
    expect(createSubscription).toHaveBeenCalledWith({ razorpayPlanId: 'plan_x', totalCount: 120, notes: { uid: 'u1', appId: 'crackloop', planId: PLAN.id } })
    expect(docSet).toHaveBeenCalledWith('razorpaySubscriptions/sub_9', expect.objectContaining({ uid: 'u1', appId: 'crackloop', planId: PLAN.id }))
  })

  it('400 recurring plan missing razorpayPlanId (not seeded)', async () => {
    getPlanById.mockResolvedValue({ ...PLAN, razorpayPlanId: null })
    expect((await POST(req({ planId: PLAN.id }))).status).toBe(400)
  })

  it('lifetime: creates order, writes order doc', async () => {
    getPlanById.mockResolvedValue({ ...PLAN, id: 'life', lifetime: true, durationMonths: null, pricePaise: 199900, razorpayPlanId: null })
    createOrder.mockResolvedValue({ id: 'order_1', amount: 199900 })
    const res = await POST(req({ planId: 'life' }))
    expect(await res.json()).toEqual({ mode: 'order', orderId: 'order_1', amountPaise: 199900, keyId: 'rzp_test_key' })
    expect(docSet).toHaveBeenCalledWith('orders/order_1', expect.objectContaining({ uid: 'u1', planId: 'life', status: 'created' }))
  })

  it('500 with generic body when razorpay fails', async () => {
    getPlanById.mockResolvedValue(PLAN)
    createSubscription.mockRejectedValue(new Error('boom'))
    const res = await POST(req({ planId: PLAN.id }))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('checkout failed')
  })
})
```

Run — Expected: FAIL.

- [ ] **Step 2: Implement**

`src/app/api/checkout/route.ts`:
```ts
import { adminDb } from '@/lib/server/firebase-admin'
import { getPlanById } from '@/lib/server/plans-store'
import { createOrder, createSubscription } from '@/lib/server/razorpay'
import { isLiveStatus } from '@/lib/server/entitlements'
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
    if (typeof body.planId !== 'string') return Response.json({ error: 'planId required' }, { status: 400 })
    if (body.promoCode !== undefined) {
      return Response.json({ error: 'promo codes not yet supported' }, { status: 400 })
    }

    const plan = await getPlanById(body.planId)
    if (!plan || !plan.active) return Response.json({ error: 'unknown plan' }, { status: 400 })

    const existing = await adminDb().doc(`users/${uid}/apps/${plan.appId}`).get()
    const status = existing.exists ? existing.data()?.subscription?.status : undefined
    if (typeof status === 'string' && (isLiveStatus(status) || status === 'lifetime')) {
      return Response.json({ error: 'subscription already active' }, { status: 409 })
    }

    const keyId = process.env.RAZORPAY_KEY_ID
    if (!keyId) throw new Error('RAZORPAY_KEY_ID env missing')

    if (plan.lifetime) {
      const order = await createOrder({
        amountPaise: plan.pricePaise,
        receipt: `${uid}-${plan.id}`.slice(0, 40),
        notes: { uid, appId: plan.appId, planId: plan.id },
      })
      await adminDb().doc(`orders/${order.id}`).set({
        uid, appId: plan.appId, planId: plan.id, amountPaise: plan.pricePaise, status: 'created', createdAt: Date.now(),
      })
      return Response.json({ mode: 'order', orderId: order.id, amountPaise: order.amount, keyId })
    }

    if (!plan.razorpayPlanId) return Response.json({ error: 'plan not available for checkout' }, { status: 400 })
    const totalCount = Math.ceil(120 / (plan.durationMonths ?? 1))
    const sub = await createSubscription({
      razorpayPlanId: plan.razorpayPlanId,
      totalCount,
      notes: { uid, appId: plan.appId, planId: plan.id },
    })
    await adminDb().doc(`razorpaySubscriptions/${sub.id}`).set({
      uid, appId: plan.appId, planId: plan.id, createdAt: Date.now(),
    })
    return Response.json({ mode: 'subscription', subscriptionId: sub.id, keyId })
  } catch (err) {
    console.error('checkout failed', err)
    return Response.json({ error: 'checkout failed' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verify** — `pnpm test` PASS, typecheck, `pnpm build` without env still succeeds.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: checkout route for subscriptions and lifetime orders"`

---

### Task 7: POST /api/checkout/verify (lifetime grant)

**Files:**
- Create: `src/app/api/checkout/verify/route.ts`, `src/app/api/checkout/verify/route.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `verifyPaymentSignature`, `getPlanById`, `buildLifetimeEntitlement`, `writeEntitlement`, `adminDb`.
- Produces: `POST /api/checkout/verify` — body `{ orderId, paymentId, signature }`, auth Bearer. Verifies HMAC with `RAZORPAY_KEY_SECRET`, loads `orders/{orderId}`, requires `order.uid === caller uid` (403 otherwise), idempotent (already-paid order → 200 `{granted:true}` without rewrite), marks order `paid` + `paymentId`, grants lifetime entitlement, writes payment record `users/{uid}/payments/{paymentId} = {amountPaise, planId, appId, type:'lifetime', createdAt}`. `400` bad signature/unknown order.

- [ ] **Step 1: Failing tests**

`src/app/api/checkout/verify/route.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireUser = vi.fn()
const verifyPaymentSignature = vi.fn()
const getPlanById = vi.fn()
const writeEntitlement = vi.fn()
const orderGet = vi.fn()
const docSet = vi.fn()

vi.mock('@/lib/server/verify-token', () => ({ requireUser, UnauthorizedError: class extends Error { status = 401 } }))
vi.mock('@/lib/server/razorpay', () => ({ verifyPaymentSignature }))
vi.mock('@/lib/server/plans-store', () => ({ getPlanById }))
vi.mock('@/lib/server/entitlements', async (importOriginal) => {
  const actual: any = await importOriginal()
  return { ...actual, writeEntitlement }
})
vi.mock('@/lib/server/firebase-admin', () => ({
  adminDb: () => ({
    doc: (path: string) => ({ get: () => orderGet(path), set: (d: unknown, o?: unknown) => docSet(path, d, o) }),
  }),
}))

import { POST } from './route'

const LIFE_PLAN = { id: 'life', appId: 'crackloop', tier: 'pro', durationMonths: null, lifetime: true, pricePaise: 199900, playStorePricePaise: null, active: true, sort: 3, razorpayPlanId: null }

function req(body: unknown) {
  return new Request('http://x', { method: 'POST', body: JSON.stringify(body), headers: { Authorization: 'Bearer t' } })
}
const GOOD = { orderId: 'order_1', paymentId: 'pay_1', signature: 'sig' }

describe('POST /api/checkout/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RAZORPAY_KEY_SECRET = 'ks'
    requireUser.mockResolvedValue({ uid: 'u1', email: null })
    verifyPaymentSignature.mockReturnValue(true)
    getPlanById.mockResolvedValue(LIFE_PLAN)
    orderGet.mockResolvedValue({ exists: true, data: () => ({ uid: 'u1', appId: 'crackloop', planId: 'life', amountPaise: 199900, status: 'created' }) })
  })

  it('400 on bad signature, nothing written', async () => {
    verifyPaymentSignature.mockReturnValue(false)
    expect((await POST(req(GOOD))).status).toBe(400)
    expect(docSet).not.toHaveBeenCalled()
    expect(writeEntitlement).not.toHaveBeenCalled()
  })

  it('403 when order belongs to another uid', async () => {
    orderGet.mockResolvedValue({ exists: true, data: () => ({ uid: 'other', status: 'created' }) })
    expect((await POST(req(GOOD))).status).toBe(403)
  })

  it('grants lifetime, marks order paid, records payment', async () => {
    const res = await POST(req(GOOD))
    expect(res.status).toBe(200)
    expect(writeEntitlement).toHaveBeenCalledWith('u1', 'crackloop', expect.objectContaining({
      subscription: expect.objectContaining({ status: 'lifetime', expiryTimeMillis: null }),
    }))
    expect(docSet).toHaveBeenCalledWith('orders/order_1', expect.objectContaining({ status: 'paid', paymentId: 'pay_1' }), { merge: true })
    expect(docSet).toHaveBeenCalledWith('users/u1/payments/pay_1', expect.objectContaining({ amountPaise: 199900, type: 'lifetime' }), { merge: true })
  })

  it('idempotent: already-paid order returns 200 without rewriting entitlement', async () => {
    orderGet.mockResolvedValue({ exists: true, data: () => ({ uid: 'u1', appId: 'crackloop', planId: 'life', status: 'paid' }) })
    const res = await POST(req(GOOD))
    expect(res.status).toBe(200)
    expect(writeEntitlement).not.toHaveBeenCalled()
  })
})
```

Run — Expected: FAIL.

- [ ] **Step 2: Implement**

`src/app/api/checkout/verify/route.ts`:
```ts
import { adminDb } from '@/lib/server/firebase-admin'
import { buildLifetimeEntitlement, writeEntitlement } from '@/lib/server/entitlements'
import { getPlanById } from '@/lib/server/plans-store'
import { verifyPaymentSignature } from '@/lib/server/razorpay'
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
    const { orderId, paymentId, signature } = body
    if (typeof orderId !== 'string' || typeof paymentId !== 'string' || typeof signature !== 'string') {
      return Response.json({ error: 'orderId, paymentId, signature required' }, { status: 400 })
    }

    const secret = process.env.RAZORPAY_KEY_SECRET
    if (!secret) throw new Error('RAZORPAY_KEY_SECRET env missing')
    if (!verifyPaymentSignature({ orderId, paymentId, signature }, secret)) {
      return Response.json({ error: 'invalid signature' }, { status: 400 })
    }

    const orderSnap = await adminDb().doc(`orders/${orderId}`).get()
    if (!orderSnap.exists) return Response.json({ error: 'unknown order' }, { status: 400 })
    const order = orderSnap.data()!
    if (order.uid !== uid) return Response.json({ error: 'forbidden' }, { status: 403 })
    if (order.status === 'paid') return Response.json({ granted: true })

    const plan = await getPlanById(order.planId)
    if (!plan?.lifetime) return Response.json({ error: 'not a lifetime order' }, { status: 400 })

    const now = Date.now()
    await writeEntitlement(uid, order.appId, buildLifetimeEntitlement({ plan, nowMillis: now }))
    await adminDb().doc(`orders/${orderId}`).set({ status: 'paid', paymentId, paidAt: now }, { merge: true })
    await adminDb().doc(`users/${uid}/payments/${paymentId}`).set(
      { amountPaise: order.amountPaise, planId: order.planId, appId: order.appId, type: 'lifetime', createdAt: now },
      { merge: true },
    )
    return Response.json({ granted: true })
  } catch (err) {
    console.error('checkout verify failed', err)
    return Response.json({ error: 'verification failed' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verify** — `pnpm test` PASS, typecheck.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: lifetime payment verification and grant"`

---

### Task 8: POST /api/razorpay/webhook

**Files:**
- Create: `src/app/api/razorpay/webhook/route.ts`, `src/app/api/razorpay/webhook/route.test.ts`

**Interfaces:**
- Consumes: `verifyWebhookSignature`, `mapWebhookEvent`, `idempotencyKeyFor`, `buildSubscriptionEntitlement`, `buildLifetimeEntitlement`, `writeEntitlement`, `getPlanById`, `adminDb`.
- Produces: `POST /api/razorpay/webhook` — headers `x-razorpay-signature`, `x-razorpay-event-id`. Flow: missing `RAZORPAY_WEBHOOK_SECRET` → 500 (fail closed) → verify signature on RAW body → 400 bad → parse → idempotency check `webhookEvents/{key}` exists → 200 `{duplicate:true}` → map event:
  - `subscription-update`: resolve `{uid, appId, planId}` from `razorpaySubscriptions/{subId}` (falls back to event `notes`), load plan, `buildSubscriptionEntitlement`, write; if `paymentId` present write payment record `users/{uid}/payments/{paymentId} = {amountPaise, planId, appId, type:'subscription', createdAt}`
  - `order-paid`: load `orders/{orderId}`; if status ≠ 'paid', grant lifetime + mark paid + payment record (backup path for Task 7)
  - `ignore`: 200
  - THEN write `webhookEvents/{key} = {event, receivedAt}` (marker AFTER effects — retry-safe) → 200 `{ok:true}`
  - Unresolvable subscription context → 200 `{ok:false, reason}` (don't make Razorpay retry forever), logged.

- [ ] **Step 1: Failing tests**

`src/app/api/razorpay/webhook/route.test.ts`:
```ts
import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const writeEntitlement = vi.fn()
const getPlanById = vi.fn()
const docGet = vi.fn()
const docSet = vi.fn()

vi.mock('@/lib/server/entitlements', async (importOriginal) => {
  const actual: any = await importOriginal()
  return { ...actual, writeEntitlement }
})
vi.mock('@/lib/server/plans-store', () => ({ getPlanById }))
vi.mock('@/lib/server/firebase-admin', () => ({
  adminDb: () => ({
    doc: (path: string) => ({ get: () => docGet(path), set: (d: unknown, o?: unknown) => docSet(path, d, o) }),
  }),
}))

import { POST } from './route'

const SECRET = 'whsec'
function signed(body: object, eventId = 'evt_1') {
  const raw = JSON.stringify(body)
  return new Request('http://x', {
    method: 'POST',
    body: raw,
    headers: {
      'x-razorpay-signature': createHmac('sha256', SECRET).update(raw).digest('hex'),
      'x-razorpay-event-id': eventId,
    },
  })
}
const CHARGED = {
  event: 'subscription.charged',
  payload: {
    subscription: { entity: { id: 'sub_1', status: 'active', current_end: 1750000000 } },
    payment: { entity: { id: 'pay_1', amount: 7900 } },
  },
}
const PLAN = { id: 'crackloop-pro-1m', appId: 'crackloop', tier: 'pro', durationMonths: 1, lifetime: false, pricePaise: 7900, playStorePricePaise: 9900, active: true, sort: 1, razorpayPlanId: 'plan_x' }

describe('POST /api/razorpay/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RAZORPAY_WEBHOOK_SECRET = SECRET
    getPlanById.mockResolvedValue(PLAN)
    docGet.mockImplementation(async (path: string) => {
      if (path === 'webhookEvents/evt_1') return { exists: false }
      if (path === 'razorpaySubscriptions/sub_1') return { exists: true, data: () => ({ uid: 'u1', appId: 'crackloop', planId: PLAN.id }) }
      return { exists: false, data: () => undefined }
    })
  })

  it('500 when secret missing (fail closed)', async () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET
    expect((await POST(signed(CHARGED))).status).toBe(500)
  })

  it('400 on bad signature, no effects', async () => {
    const raw = JSON.stringify(CHARGED)
    const req = new Request('http://x', { method: 'POST', body: raw, headers: { 'x-razorpay-signature': 'bad' } })
    expect((await POST(req)).status).toBe(400)
    expect(writeEntitlement).not.toHaveBeenCalled()
  })

  it('duplicate event id short-circuits', async () => {
    docGet.mockImplementation(async (path: string) =>
      path === 'webhookEvents/evt_1' ? { exists: true } : { exists: false },
    )
    const res = await POST(signed(CHARGED))
    expect((await res.json()).duplicate).toBe(true)
    expect(writeEntitlement).not.toHaveBeenCalled()
  })

  it('charged: grants entitlement, records payment, writes marker LAST', async () => {
    const res = await POST(signed(CHARGED))
    expect(res.status).toBe(200)
    expect(writeEntitlement).toHaveBeenCalledWith('u1', 'crackloop', expect.objectContaining({
      subscription: expect.objectContaining({ status: 'active', expiryTimeMillis: 1750000000000, razorpaySubscriptionId: 'sub_1' }),
      entitlements: { adFree: true, unlimitedAi: false },
    }))
    expect(docSet).toHaveBeenCalledWith('users/u1/payments/pay_1', expect.objectContaining({ amountPaise: 7900, type: 'subscription' }), { merge: true })
    const setPaths = docSet.mock.calls.map((c) => c[0])
    expect(setPaths.indexOf('webhookEvents/evt_1')).toBe(setPaths.length - 1)
  })

  it('halted: revokes grants', async () => {
    const halted = { ...CHARGED, event: 'subscription.halted', payload: { subscription: { entity: { id: 'sub_1', status: 'halted', current_end: 1750000000 } } } }
    await POST(signed(halted, 'evt_2'))
    expect(writeEntitlement).toHaveBeenCalledWith('u1', 'crackloop', expect.objectContaining({
      entitlements: { adFree: false, unlimitedAi: false },
    }))
  })

  it('unknown subscription context returns 200 ok:false without throwing', async () => {
    docGet.mockImplementation(async (path: string) =>
      path.startsWith('webhookEvents/') ? { exists: false } : { exists: false, data: () => undefined },
    )
    const res = await POST(signed(CHARGED, 'evt_3'))
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(false)
    expect(writeEntitlement).not.toHaveBeenCalled()
  })

  it('order.paid backup grants lifetime when order not yet paid', async () => {
    getPlanById.mockResolvedValue({ ...PLAN, id: 'life', lifetime: true, durationMonths: null, razorpayPlanId: null })
    docGet.mockImplementation(async (path: string) => {
      if (path === 'webhookEvents/evt_4') return { exists: false }
      if (path === 'orders/order_1') return { exists: true, data: () => ({ uid: 'u1', appId: 'crackloop', planId: 'life', amountPaise: 199900, status: 'created' }) }
      return { exists: false }
    })
    const body = { event: 'order.paid', payload: { order: { entity: { id: 'order_1' } }, payment: { entity: { id: 'pay_9', amount: 199900 } } } }
    const res = await POST(signed(body, 'evt_4'))
    expect(res.status).toBe(200)
    expect(writeEntitlement).toHaveBeenCalledWith('u1', 'crackloop', expect.objectContaining({
      subscription: expect.objectContaining({ status: 'lifetime' }),
    }))
    expect(docSet).toHaveBeenCalledWith('orders/order_1', expect.objectContaining({ status: 'paid' }), { merge: true })
  })

  it('ignored events return 200 and only write marker', async () => {
    const body = { event: 'refund.processed', payload: {} }
    const res = await POST(signed(body, 'evt_5'))
    expect(res.status).toBe(200)
    expect(writeEntitlement).not.toHaveBeenCalled()
    expect(docSet).toHaveBeenCalledTimes(1)
    expect(docSet.mock.calls[0][0]).toBe('webhookEvents/evt_5')
  })
})
```

Run — Expected: FAIL.

- [ ] **Step 2: Implement**

`src/app/api/razorpay/webhook/route.ts`:
```ts
import { adminDb } from '@/lib/server/firebase-admin'
import {
  buildLifetimeEntitlement,
  buildSubscriptionEntitlement,
  writeEntitlement,
} from '@/lib/server/entitlements'
import { getPlanById } from '@/lib/server/plans-store'
import { verifyWebhookSignature } from '@/lib/server/razorpay'
import { idempotencyKeyFor, mapWebhookEvent } from '@/lib/server/webhook-events'

export const runtime = 'nodejs'

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) {
    console.error('webhook: RAZORPAY_WEBHOOK_SECRET missing')
    return Response.json({ error: 'webhook not configured' }, { status: 500 })
  }

  const raw = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''
  if (!verifyWebhookSignature(raw, signature, secret)) {
    return Response.json({ error: 'invalid signature' }, { status: 400 })
  }

  try {
    const body = JSON.parse(raw)
    const key = idempotencyKeyFor(body, req.headers.get('x-razorpay-event-id'))
    const markerRef = adminDb().doc(`webhookEvents/${key}`)
    if ((await markerRef.get()).exists) return Response.json({ duplicate: true })

    const effect = mapWebhookEvent(body)
    const now = Date.now()

    if (effect.kind === 'subscription-update') {
      const idx = await adminDb().doc(`razorpaySubscriptions/${effect.subscriptionId}`).get()
      const notes = body?.payload?.subscription?.entity?.notes
      const ctx = idx.exists ? idx.data() : notes?.uid ? { uid: notes.uid, appId: notes.appId, planId: notes.planId } : null
      if (!ctx?.uid || !ctx.appId || !ctx.planId) {
        console.error('webhook: unresolvable subscription context', effect.subscriptionId)
        return Response.json({ ok: false, reason: 'unknown subscription' })
      }
      const plan = await getPlanById(ctx.planId)
      if (!plan) {
        console.error('webhook: unknown plan', ctx.planId)
        return Response.json({ ok: false, reason: 'unknown plan' })
      }
      await writeEntitlement(
        ctx.uid,
        ctx.appId,
        buildSubscriptionEntitlement({
          plan,
          status: effect.status,
          currentEndMillis: effect.currentEndMillis,
          razorpaySubscriptionId: effect.subscriptionId,
          nowMillis: now,
        }),
      )
      if (effect.paymentId && effect.amountPaise !== null) {
        await adminDb().doc(`users/${ctx.uid}/payments/${effect.paymentId}`).set(
          { amountPaise: effect.amountPaise, planId: ctx.planId, appId: ctx.appId, type: 'subscription', createdAt: now },
          { merge: true },
        )
      }
    } else if (effect.kind === 'order-paid') {
      const orderSnap = await adminDb().doc(`orders/${effect.orderId}`).get()
      const order = orderSnap.exists ? orderSnap.data() : null
      if (order && order.status !== 'paid') {
        const plan = await getPlanById(order.planId)
        if (plan?.lifetime) {
          await writeEntitlement(order.uid, order.appId, buildLifetimeEntitlement({ plan, nowMillis: now }))
          await adminDb().doc(`orders/${effect.orderId}`).set({ status: 'paid', paymentId: effect.paymentId, paidAt: now }, { merge: true })
          await adminDb().doc(`users/${order.uid}/payments/${effect.paymentId}`).set(
            { amountPaise: effect.amountPaise, planId: order.planId, appId: order.appId, type: 'lifetime', createdAt: now },
            { merge: true },
          )
        }
      }
    }

    await markerRef.set({ event: body?.event ?? 'unknown', receivedAt: now }, { merge: true })
    return Response.json({ ok: true })
  } catch (err) {
    console.error('webhook processing failed', err)
    return Response.json({ error: 'processing failed' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verify** — `pnpm test` PASS, typecheck, build without env.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: hmac-verified idempotent razorpay webhook with entitlement writes"`

---

### Task 9: Cancel + account summary API

**Files:**
- Create: `src/app/api/subscription/cancel/route.ts`, `src/app/api/subscription/cancel/route.test.ts`, `src/app/api/me/summary/route.ts`, `src/app/api/me/summary/route.test.ts`

**Interfaces:**
- Produces:
  - `POST /api/subscription/cancel` body `{appId: string}` — reads CALLER's own `users/{uid}/apps/{appId}` (never body-supplied sub id), requires `razorpaySubscriptionId`, calls `cancelSubscriptionAtCycleEnd`, merge-sets `subscription.autoRenewing = false` (dot-path merge). 400 no appId / no cancellable sub; 401 unauth.
  - `GET /api/me/summary` — returns `{ apps: Array<{ appId: string; subscription: EntitlementDoc['subscription'] | null; entitlements: EntitlementDoc['entitlements'] | null }>, payments: Array<{ id: string; amountPaise: number; planId: string; appId: string; type: string; createdAt: number }> }` — apps from `users/{uid}/apps` listDocuments+get, payments from collection query ordered `createdAt desc` limit 20.

- [ ] **Step 1: Failing tests**

`src/app/api/subscription/cancel/route.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireUser = vi.fn()
const cancelSubscriptionAtCycleEnd = vi.fn()
const docGet = vi.fn()
const docSet = vi.fn()

vi.mock('@/lib/server/verify-token', () => ({ requireUser, UnauthorizedError: class extends Error { status = 401 } }))
vi.mock('@/lib/server/razorpay', () => ({ cancelSubscriptionAtCycleEnd }))
vi.mock('@/lib/server/firebase-admin', () => ({
  adminDb: () => ({ doc: (path: string) => ({ get: () => docGet(path), set: (d: unknown, o?: unknown) => docSet(path, d, o) }) }),
}))

import { POST } from './route'

function req(body: unknown) {
  return new Request('http://x', { method: 'POST', body: JSON.stringify(body), headers: { Authorization: 'Bearer t' } })
}

describe('POST /api/subscription/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireUser.mockResolvedValue({ uid: 'u1', email: null })
    docGet.mockResolvedValue({ exists: true, data: () => ({ subscription: { razorpaySubscriptionId: 'sub_1', status: 'active' } }) })
    cancelSubscriptionAtCycleEnd.mockResolvedValue({ id: 'sub_1', status: 'cancelled' })
  })

  it('cancels own subscription from own doc only', async () => {
    const res = await POST(req({ appId: 'crackloop' }))
    expect(res.status).toBe(200)
    expect(docGet).toHaveBeenCalledWith('users/u1/apps/crackloop')
    expect(cancelSubscriptionAtCycleEnd).toHaveBeenCalledWith('sub_1')
    expect(docSet).toHaveBeenCalledWith('users/u1/apps/crackloop', { subscription: { autoRenewing: false } }, { mergeFields: ['subscription.autoRenewing'] })
  })

  it('400 when no cancellable subscription', async () => {
    docGet.mockResolvedValue({ exists: false, data: () => undefined })
    expect((await POST(req({ appId: 'crackloop' }))).status).toBe(400)
    expect(cancelSubscriptionAtCycleEnd).not.toHaveBeenCalled()
  })

  it('400 on lifetime (nothing to cancel)', async () => {
    docGet.mockResolvedValue({ exists: true, data: () => ({ subscription: { razorpaySubscriptionId: null, status: 'lifetime' } }) })
    expect((await POST(req({ appId: 'crackloop' }))).status).toBe(400)
  })
})
```

`src/app/api/me/summary/route.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireUser = vi.fn()
const listDocuments = vi.fn()
const paymentsGet = vi.fn()

vi.mock('@/lib/server/verify-token', () => ({ requireUser, UnauthorizedError: class extends Error { status = 401 } }))
vi.mock('@/lib/server/firebase-admin', () => ({
  adminDb: () => ({
    collection: (path: string) =>
      path.endsWith('/payments')
        ? { orderBy: () => ({ limit: () => ({ get: paymentsGet }) }) }
        : { listDocuments },
  }),
}))

import { GET } from './route'

describe('GET /api/me/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireUser.mockResolvedValue({ uid: 'u1', email: null })
    listDocuments.mockResolvedValue([
      { id: 'crackloop', get: async () => ({ exists: true, data: () => ({ subscription: { status: 'active' }, entitlements: { adFree: true, unlimitedAi: false } }) }) },
    ])
    paymentsGet.mockResolvedValue({ docs: [{ id: 'pay_1', data: () => ({ amountPaise: 7900, planId: 'p', appId: 'crackloop', type: 'subscription', createdAt: 5 }) }] })
  })

  it('returns own apps and payments', async () => {
    const res = await GET(new Request('http://x', { headers: { Authorization: 'Bearer t' } }))
    const json = await res.json()
    expect(json.apps).toEqual([{ appId: 'crackloop', subscription: { status: 'active' }, entitlements: { adFree: true, unlimitedAi: false } }])
    expect(json.payments).toEqual([{ id: 'pay_1', amountPaise: 7900, planId: 'p', appId: 'crackloop', type: 'subscription', createdAt: 5 }])
  })

  it('401 when unauthenticated', async () => {
    const { UnauthorizedError } = await import('@/lib/server/verify-token')
    requireUser.mockRejectedValue(new UnauthorizedError('no'))
    expect((await GET(new Request('http://x'))).status).toBe(401)
  })
})
```

Run — Expected: FAIL.

- [ ] **Step 2: Implement**

`src/app/api/subscription/cancel/route.ts`:
```ts
import { adminDb } from '@/lib/server/firebase-admin'
import { cancelSubscriptionAtCycleEnd } from '@/lib/server/razorpay'
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
    if (typeof body.appId !== 'string') return Response.json({ error: 'appId required' }, { status: 400 })

    const ref = adminDb().doc(`users/${uid}/apps/${body.appId}`)
    const snap = await ref.get()
    const subId = snap.exists ? snap.data()?.subscription?.razorpaySubscriptionId : null
    if (!subId) return Response.json({ error: 'no cancellable subscription' }, { status: 400 })

    await cancelSubscriptionAtCycleEnd(subId)
    await ref.set({ subscription: { autoRenewing: false } }, { mergeFields: ['subscription.autoRenewing'] })
    return Response.json({ cancelled: true })
  } catch (err) {
    console.error('cancel failed', err)
    return Response.json({ error: 'cancel failed' }, { status: 500 })
  }
}
```

`src/app/api/me/summary/route.ts`:
```ts
import { adminDb } from '@/lib/server/firebase-admin'
import { requireUser, UnauthorizedError } from '@/lib/server/verify-token'

export const runtime = 'nodejs'

export async function GET(req: Request): Promise<Response> {
  let uid: string
  try {
    ;({ uid } = await requireUser(req))
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'unauthorized' }, { status: 401 })
    throw err
  }

  try {
    const db = adminDb()
    const appRefs = await db.collection(`users/${uid}/apps`).listDocuments()
    const apps = await Promise.all(
      appRefs.map(async (ref) => {
        const snap = await ref.get()
        const data = snap.exists ? snap.data() : undefined
        return { appId: ref.id, subscription: data?.subscription ?? null, entitlements: data?.entitlements ?? null }
      }),
    )
    const paymentsSnap = await db.collection(`users/${uid}/payments`).orderBy('createdAt', 'desc').limit(20).get()
    const payments = paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    return Response.json({ apps, payments })
  } catch (err) {
    console.error('summary failed', err)
    return Response.json({ error: 'summary failed' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verify** — `pnpm test` PASS, typecheck.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: owner-bound cancel and account summary api"`

---

### Task 10: GET /api/v1/plans (public, for Android app)

**Files:**
- Create: `src/app/api/v1/plans/route.ts`, `src/app/api/v1/plans/route.test.ts`

**Interfaces:**
- Produces: `GET /api/v1/plans?app=crackloop` — public, no auth. Returns `{ plans: Array<{ id; tier; durationMonths; lifetime; pricePaise }> }` — strips `razorpayPlanId`, `playStorePricePaise`, `sort`, `active` (internal fields never leak). 400 missing/unknown `app` param. `Cache-Control: public, max-age=300`.

- [ ] **Step 1: Failing tests**

`src/app/api/v1/plans/route.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getPlansFromDb = vi.fn()
vi.mock('@/lib/server/plans-store', () => ({ getPlansFromDb }))

import { GET } from './route'

describe('GET /api/v1/plans', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPlansFromDb.mockResolvedValue([
      { id: 'p1', appId: 'crackloop', tier: 'pro', durationMonths: 1, lifetime: false, pricePaise: 7900, playStorePricePaise: 9900, active: true, sort: 1, razorpayPlanId: 'plan_x' },
    ])
  })

  it('400 without app param', async () => {
    expect((await GET(new Request('http://x/api/v1/plans'))).status).toBe(400)
  })

  it('400 for unknown app', async () => {
    expect((await GET(new Request('http://x/api/v1/plans?app=nope'))).status).toBe(400)
  })

  it('returns public plan fields only, with cache header', async () => {
    const res = await GET(new Request('http://x/api/v1/plans?app=crackloop'))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('max-age=300')
    const json = await res.json()
    expect(json.plans).toEqual([{ id: 'p1', tier: 'pro', durationMonths: 1, lifetime: false, pricePaise: 7900 }])
  })
})
```

Run — Expected: FAIL.

- [ ] **Step 2: Implement**

`src/app/api/v1/plans/route.ts`:
```ts
import { getApp } from '@/config/apps'
import { getPlansFromDb } from '@/lib/server/plans-store'

export const runtime = 'nodejs'

export async function GET(req: Request): Promise<Response> {
  const app = new URL(req.url).searchParams.get('app')
  if (!app || !getApp(app)) return Response.json({ error: 'unknown app' }, { status: 400 })

  const plans = await getPlansFromDb(app)
  const publicPlans = plans.map((p) => ({
    id: p.id,
    tier: p.tier,
    durationMonths: p.durationMonths,
    lifetime: p.lifetime,
    pricePaise: p.pricePaise,
  }))
  return Response.json({ plans: publicPlans }, { headers: { 'Cache-Control': 'public, max-age=300' } })
}
```

- [ ] **Step 3: Verify** — `pnpm test` PASS, typecheck.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: public plans api for android app"`

---

### Task 11: Checkout island + account billing UI

**Files:**
- Create: `src/components/checkout-button.tsx`, `src/components/checkout-button.test.tsx`
- Modify: `src/components/plan-card.tsx` (swap placeholder button), `src/app/account/account-view.tsx` (subscriptions + payments + cancel)

**Interfaces:**
- Consumes: `useAuth` (`user.getIdToken()`), `ConfirmModal`, `formatINR`, `Badge`, `Button`, `Card`, plan props.
- Produces: `<CheckoutButton plan={Plan} />` client component:
  1. Not signed in → button label "Sign in to subscribe" → `signIn()`
  2. Signed in → POST `/api/checkout` with Bearer token → on `{mode:'subscription'}` open Razorpay modal with `{key, subscription_id}`; on `{mode:'order'}` open with `{key, order_id, amount}` and on success POST `/api/checkout/verify` with handler response
  3. Razorpay script (`https://checkout.razorpay.com/v1/checkout.js`) injected only on first click (never on page load)
  4. Pending state ("Starting…"), error line under button (role="alert"), 409 shows "You already have an active plan"
  5. Success → `window.location.assign('/account')`
- AccountView: fetches `/api/me/summary` with Bearer token; renders per-app subscription Card (tier label PRO/AI, status Badge, expiry date via `new Date(expiryTimeMillis).toLocaleDateString()`, 'Lifetime' when null), Cancel button (only when `autoRenewing && razorpaySubscriptionId`) opening `ConfirmModal` (destructive) → POST `/api/subscription/cancel` → refetch; payments list (date, plan, `formatINR(amountPaise)`); error state on fetch failure (`role="alert"`, Retry button).

- [ ] **Step 1: Failing tests**

`src/components/checkout-button.test.tsx`:
```tsx
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const signIn = vi.fn()
let mockUser: any = null
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: mockUser, loading: false, signIn, signOut: vi.fn() }),
}))

import type { Plan } from '@/config/plans'
import { CheckoutButton } from './checkout-button'

const plan: Plan = { id: 'p1', appId: 'crackloop', tier: 'pro', durationMonths: 1, lifetime: false, pricePaise: 7900, playStorePricePaise: 9900, active: true, sort: 1 }

afterEach(cleanup)

describe('CheckoutButton', () => {
  beforeEach(() => vi.clearAllMocks())

  it('prompts sign-in when signed out', () => {
    mockUser = null
    render(<CheckoutButton plan={plan} />)
    fireEvent.click(screen.getByRole('button', { name: /sign in to subscribe/i }))
    expect(signIn).toHaveBeenCalled()
  })

  it('shows API error to the user', async () => {
    mockUser = { getIdToken: vi.fn().mockResolvedValue('tok') }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'subscription already active' }), { status: 409 })))
    render(<CheckoutButton plan={plan} />)
    fireEvent.click(screen.getByRole('button', { name: /subscribe/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/already have an active plan/i))
    vi.unstubAllGlobals()
  })

  it('sends bearer token and planId to checkout api', async () => {
    mockUser = { getIdToken: vi.fn().mockResolvedValue('tok') }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'x' }), { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<CheckoutButton plan={plan} />)
    fireEvent.click(screen.getByRole('button', { name: /subscribe/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/checkout')
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body)).toEqual({ planId: 'p1' })
    vi.unstubAllGlobals()
  })
})
```

Run — Expected: FAIL.

- [ ] **Step 2: Implement CheckoutButton**

`src/components/checkout-button.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { Plan } from '@/config/plans'
import { useAuth } from '@/lib/auth-context'

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void }
  }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve()
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('failed to load checkout'))
    document.body.appendChild(script)
  })
}

export function CheckoutButton({ plan }: { plan: Plan }) {
  const { user, signIn } = useAuth()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startCheckout() {
    if (!user) {
      await signIn()
      return
    }
    setPending(true)
    setError(null)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409) throw new Error('You already have an active plan for this app.')
      if (!res.ok) throw new Error(data.error ?? 'Checkout failed. Try again.')

      await loadRazorpayScript()
      const base = {
        key: data.keyId,
        name: 'Impact Loop',
        theme: { color: '#7c5cff' },
      }
      if (data.mode === 'subscription') {
        new window.Razorpay!({
          ...base,
          subscription_id: data.subscriptionId,
          handler: () => window.location.assign('/account'),
        }).open()
      } else {
        new window.Razorpay!({
          ...base,
          order_id: data.orderId,
          amount: data.amountPaise,
          currency: 'INR',
          handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            const verifyRes = await fetch('/api/checkout/verify', {
              method: 'POST',
              headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: resp.razorpay_order_id,
                paymentId: resp.razorpay_payment_id,
                signature: resp.razorpay_signature,
              }),
            })
            if (verifyRes.ok) window.location.assign('/account')
            else setError('Payment received but verification failed — contact support.')
          },
        }).open()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed. Try again.')
    } finally {
      setPending(false)
    }
  }

  const label = !user ? 'Sign in to subscribe' : plan.lifetime ? 'Buy once' : 'Subscribe'
  return (
    <div className="flex flex-col gap-2">
      <Button onClick={() => void startCheckout()} disabled={pending} className="w-full">
        {pending ? 'Starting…' : label}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-red-500">
          {error}
        </p>
      ) : null}
    </div>
  )
}
```

In `src/components/plan-card.tsx`: replace the placeholder `<Button href="/account">…</Button>` block with:
```tsx
<CheckoutButton plan={plan} />
```
(import `{ CheckoutButton } from './checkout-button'`; remove the now-unused `Button` import if nothing else uses it.)

- [ ] **Step 3: Account billing UI**

Rewrite `src/app/account/account-view.tsx`:
```tsx
'use client'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmModal } from '@/components/ui/modal'
import { formatINR } from '@/lib/format'
import { useAuth } from '@/lib/auth-context'

type Summary = {
  apps: Array<{
    appId: string
    subscription: {
      status: string
      planId: string
      tier: 'pro' | 'ai'
      expiryTimeMillis: number | null
      autoRenewing: boolean
      razorpaySubscriptionId: string | null
    } | null
    entitlements: { adFree: boolean; unlimitedAi: boolean } | null
  }>
  payments: Array<{ id: string; amountPaise: number; planId: string; appId: string; type: string; createdAt: number }>
}

const TIER_LABEL = { pro: 'Pro', ai: 'AI' } as const

export function AccountView() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [fetchError, setFetchError] = useState(false)
  const [cancelApp, setCancelApp] = useState<string | null>(null)
  const [cancelPending, setCancelPending] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setFetchError(false)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/me/summary', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('summary failed')
      setSummary(await res.json())
    } catch {
      setFetchError(true)
    }
  }, [user])

  useEffect(() => {
    if (!loading && !user) router.replace('/')
  }, [loading, user, router])

  useEffect(() => {
    void load()
  }, [load])

  async function confirmCancel() {
    if (!user || !cancelApp) return
    setCancelPending(true)
    try {
      const token = await user.getIdToken()
      await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: cancelApp }),
      })
      await load()
    } finally {
      setCancelPending(false)
      setCancelApp(null)
    }
  }

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

      <h2 className="mt-10 font-display text-xl font-semibold text-fg">Subscriptions</h2>
      {fetchError ? (
        <Card className="mt-4">
          <p role="alert" className="text-sm text-red-500">
            Couldn’t load your subscriptions.
          </p>
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        </Card>
      ) : !summary ? (
        <p className="mt-4 text-sm text-muted">Loading…</p>
      ) : summary.apps.length === 0 ? (
        <Card className="mt-4">
          <p className="text-sm text-muted">No subscriptions yet.</p>
          <div className="mt-4">
            <Button href="/pricing" size="sm">
              See plans
            </Button>
          </div>
        </Card>
      ) : (
        summary.apps.map(({ appId, subscription }) => (
          <Card key={appId} className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-lg font-semibold capitalize text-fg">{appId}</h3>
              {subscription ? (
                <Badge tone={subscription.status === 'active' || subscription.status === 'lifetime' ? 'success' : 'warn'}>
                  {subscription.status}
                </Badge>
              ) : null}
            </div>
            {subscription ? (
              <>
                <p className="mt-2 text-sm text-muted">
                  {TIER_LABEL[subscription.tier]} ·{' '}
                  {subscription.expiryTimeMillis === null
                    ? 'Lifetime'
                    : `${subscription.autoRenewing ? 'Renews' : 'Ends'} ${new Date(subscription.expiryTimeMillis).toLocaleDateString()}`}
                </p>
                {subscription.autoRenewing && subscription.razorpaySubscriptionId ? (
                  <div className="mt-4">
                    <Button variant="outline" size="sm" onClick={() => setCancelApp(appId)}>
                      Cancel subscription
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">No active subscription.</p>
            )}
          </Card>
        ))
      )}

      {summary && summary.payments.length > 0 ? (
        <>
          <h2 className="mt-10 font-display text-xl font-semibold text-fg">Payment history</h2>
          <Card className="mt-4">
            <ul className="divide-y divide-line">
              {summary.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-3 text-sm">
                  <span className="text-muted">
                    {new Date(p.createdAt).toLocaleDateString()} · {p.appId} · {p.type}
                  </span>
                  <span className="font-medium text-fg">{formatINR(p.amountPaise)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      ) : null}

      <ConfirmModal
        open={cancelApp !== null}
        title="Cancel subscription?"
        body="Your plan stays active until the end of the current billing period, then won’t renew."
        confirmLabel={cancelPending ? 'Cancelling…' : 'Yes, cancel'}
        onConfirm={() => void confirmCancel()}
        onClose={() => setCancelApp(null)}
        destructive
      />
    </div>
  )
}
```

- [ ] **Step 4: Verify** — `pnpm test` PASS (checkout-button tests + full suite), `pnpm typecheck`, `pnpm build` without env.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: razorpay checkout island and account billing ui"`

---

### Task 12: Firestore rules, env docs, manual test-mode gate

**Files:**
- Create: `firestore.rules`, `docs/BILLING-TEST-GATE.md`
- Modify: `README.md` (billing row → shipped, describe reality), `.env.local.example` (already has vars from Task 1 — verify)

**Interfaces:** none (config + docs).

- [ ] **Step 1: firestore.rules (default deny)**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // All reads/writes go through the Admin SDK in API routes.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 2: Manual gate doc**

`docs/BILLING-TEST-GATE.md`:
```markdown
# Billing manual gate (Razorpay TEST mode)

Prereqs: .env.local filled (FIREBASE_SERVICE_ACCOUNT, RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET with TEST keys),
Firebase authorized domains include localhost + the Vercel preview domain,
Razorpay dashboard webhook -> https://<preview-domain>/api/razorpay/webhook (events: subscription.*, order.paid),
plans seeded: `node --env-file=.env.local scripts/seed-plans.mjs`,
firestore rules deployed: `firebase deploy --only firestore:rules`.

Walk each row, record PASS/FAIL:

| # | Flow | Steps | Expect |
|---|------|-------|--------|
| 1 | Recurring checkout | /pricing -> Subscribe (1m pro) -> test card | Razorpay modal opens; after pay, redirected to /account |
| 2 | Webhook grant | wait ~1min after #1 | /account shows active Pro sub with renew date; Firestore users/{uid}/apps/crackloop has entitlements.adFree=true |
| 3 | Duplicate guard | /pricing -> Subscribe same app again | inline error "already have an active plan" |
| 4 | Payment history | /account | payment row with amount ₹79 |
| 5 | Cancel | /account -> Cancel -> confirm modal | status keeps until period end, autoRenewing=false, "Ends <date>" |
| 6 | Lifetime | new test user -> Buy once | order modal, verify success, /account shows Lifetime |
| 7 | Lifetime webhook backup | check Firestore webhookEvents | order.paid marker exists; no duplicate payment rows |
| 8 | Plans API | GET /api/v1/plans?app=crackloop | public fields only, no razorpayPlanId |
| 9 | Webhook security | POST garbage to /api/razorpay/webhook | 400; nothing written |
```

- [ ] **Step 3: README** — flip Billing row to: `| Billing | Razorpay subscriptions + lifetime orders (webhook-driven entitlements) |` and update the highlights line to mention checkout + account management now exist. Do not oversell: promo codes/trials/admin remain planned.

- [ ] **Step 4: Verify** — `pnpm test && pnpm typecheck && pnpm build` all green.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: firestore lockdown rules, billing test gate docs"`

---

## Out of scope for Plan 2
- Promo codes, discounts, referrals (Plan 4) — checkout rejects `promoCode` for now
- Admin dashboards, plan CRUD UI, free trials (Plan 3) — plans seeded via script
- Automated payouts, GST invoices
- Razorpay Offers (first-cycle promo discount) — lands with Plan 4 promo work; test-mode decision recorded there
```
