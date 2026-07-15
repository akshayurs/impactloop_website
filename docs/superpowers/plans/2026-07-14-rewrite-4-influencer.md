# Rewrite Plan 4/4 — Influencer / Promo / Referral System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full influencer economy: apply → admin approves + sets rates → influencer picks/changes promo code → referral links attribute signups → buyers get promo benefit at checkout → commissions recorded on webhook-confirmed payments → influencer dashboard shows earnings → admin marks manual payouts.

**Architecture:** All money/attribution server-side. Promo benefit implementation (Razorpay constraint — programmatic Offers unavailable): **lifetime orders get a direct server-side price cut; recurring subscriptions get equivalent free days via `start_at` delay** (10% off a 30-day plan = 3 free days before first charge; single checkout modal, mandate authorized now). `offerId` reserved on the influencer doc for a future dashboard-managed Offers upgrade. Commissions recorded ONLY from webhook/verified payments, valued at the influencer's rates AT PAYMENT TIME. Balance = Σ commissions − Σ payouts, always computed.

**Spec:** `docs/superpowers/specs/2026-07-14-website-rewrite-design.md` §2 (influencer/admin routes), §3 (influencers/promoCodes/referrals/payouts collections, attribution mechanics)
**Builds on:** Plans 1-3. Key seams: checkout route's `promoCode` 400-rejection is REMOVED and replaced with real handling; `settings.promoDefaultExpiryMonths` already exists; `withAdmin` guard; `EntitlementDoc`; account-view; admin shell.

## Global Constraints

- Commission + discount amounts integer paise; percentages integer 0–90; all money math server-side
- Promo codes: slug `[A-Z0-9]{4,16}` (uppercase, easy to say aloud); a code is available iff `promoCodes/{code}` does not exist; changing codes deletes the old doc (old links stop working — by design); default expiry = `settings.promoDefaultExpiryMonths` from creation
- Influencer cannot use their own code (checkout + claim both reject)
- Referral attribution: `?ref=CODE` → cookie `il_ref` (30 days, SameSite=Lax) → claimed once per account at first sign-in; `users/{uid}.referredBy` immutable once set
- Signup commission recorded at claim time; subscription/lifetime commissions recorded only on webhook-confirmed payment; rates read from influencer doc at that moment
- No self-referral: claim rejects when code owner uid === claimer uid
- Commission recording must be idempotent per payment (referral doc id = `pay-{paymentId}` for payments, `signup-{uid}` for signups)
- Every admin route via `withAdmin`; every influencer route verifies caller owns the influencer doc; approved-status required for promo/earnings operations
- `pnpm build` green without env; no firebase-admin in client bundles
- Conventional Commits; vi.hoisted() mocks; never mockReset with rejected-promise mocks

## File Structure

```
src/lib/server/
  promo.ts            # pure: code validation, discount math, free-days, commission valuation
  influencer.ts       # store: apply/approve/rates/code-change/referrals/balance
src/app/api/
  influencer/apply/route.ts        # POST
  influencer/me/route.ts           # GET
  influencer/promo-code/route.ts   # POST (change/set code)
  referral/claim/route.ts          # POST
  promo/validate/route.ts          # GET ?code= (public: is code valid + discountPct — for checkout UX + Android app)
  admin/influencers/route.ts       # GET list
  admin/influencers/[uid]/route.ts # POST actions
src/app/api/checkout/route.ts      # MODIFY: real promoCode handling
src/app/api/checkout/verify/route.ts   # MODIFY: lifetime commission
src/app/api/razorpay/webhook/route.ts  # MODIFY: subscription commission
src/components/referral-catcher.tsx    # client: ?ref → cookie
src/components/promo-input.tsx         # client: code entry on plan card
src/components/checkout-button.tsx     # MODIFY: sends promoCode
src/app/influencer/page.tsx + src/components/influencer-portal.tsx
src/app/admin/influencers/page.tsx + src/components/admin/influencers.tsx
src/app/account/account-view.tsx       # MODIFY: apply-to-be-influencer card
src/app/admin/layout.tsx               # MODIFY: + Influencers tab
src/app/layout.tsx                     # MODIFY: mount ReferralCatcher
```

---

### Task 1: Pure promo domain module

**Files:**
- Create: `src/lib/server/promo.ts`, `src/lib/server/promo.test.ts`

**Interfaces:**
- Produces:
  - `PROMO_CODE_RE = /^[A-Z0-9]{4,16}$/`, `normalizeCode(raw: string): string` (trim+uppercase)
  - `type PromoDoc = { code: string; ownerUid: string; active: boolean; createdAt: number; expiresAt: number }`
  - `isPromoUsable(doc: PromoDoc | undefined, nowMillis: number): { ok: true } | { ok: false; reason: 'not-found' | 'inactive' | 'expired' }`
  - `discountedPaise(pricePaise: number, discountPct: number): number` — `Math.round(pricePaise * (100 - discountPct) / 100)`; throws on non-int price or pct outside 0–90
  - `freeDaysFor(durationMonths: number, discountPct: number): number` — `Math.round(durationMonths * 30 * discountPct / 100)`, min 0
  - `commissionForPlan(rates: { signupPaise: number; perPlan: Record<string, number> }, planId: string): number` — perPlan lookup, 0 when absent
  - `expiryFromNow(nowMillis: number, months: number): number` — `now + months * 30 * 86_400_000`

- [ ] **Step 1: Failing tests**

`src/lib/server/promo.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import {
  PROMO_CODE_RE,
  commissionForPlan,
  discountedPaise,
  expiryFromNow,
  freeDaysFor,
  isPromoUsable,
  normalizeCode,
  type PromoDoc,
} from './promo'

const doc: PromoDoc = { code: 'AKSHAY10', ownerUid: 'inf1', active: true, createdAt: 0, expiresAt: 100 }

describe('code shape', () => {
  it('normalizes and validates', () => {
    expect(normalizeCode('  akshay10 ')).toBe('AKSHAY10')
    expect(PROMO_CODE_RE.test('AKSHAY10')).toBe(true)
    expect(PROMO_CODE_RE.test('ab')).toBe(false)
    expect(PROMO_CODE_RE.test('HAS SPACE')).toBe(false)
  })
})

describe('isPromoUsable', () => {
  it('ok for active unexpired', () => expect(isPromoUsable(doc, 50)).toEqual({ ok: true }))
  it('not-found / inactive / expired reasons', () => {
    expect(isPromoUsable(undefined, 50)).toEqual({ ok: false, reason: 'not-found' })
    expect(isPromoUsable({ ...doc, active: false }, 50)).toEqual({ ok: false, reason: 'inactive' })
    expect(isPromoUsable(doc, 101)).toEqual({ ok: false, reason: 'expired' })
  })
})

describe('money math', () => {
  it('discountedPaise rounds correctly', () => {
    expect(discountedPaise(7900, 10)).toBe(7110)
    expect(discountedPaise(9999, 33)).toBe(6699)
    expect(discountedPaise(7900, 0)).toBe(7900)
  })
  it('rejects invalid inputs', () => {
    expect(() => discountedPaise(79.5, 10)).toThrow()
    expect(() => discountedPaise(7900, 95)).toThrow()
    expect(() => discountedPaise(7900, -1)).toThrow()
  })
  it('freeDaysFor scales with duration and pct', () => {
    expect(freeDaysFor(1, 10)).toBe(3)
    expect(freeDaysFor(12, 10)).toBe(36)
    expect(freeDaysFor(1, 0)).toBe(0)
  })
  it('commissionForPlan looks up per-plan rate, 0 default', () => {
    const rates = { signupPaise: 500, perPlan: { 'crackloop-pro-1m': 1000 } }
    expect(commissionForPlan(rates, 'crackloop-pro-1m')).toBe(1000)
    expect(commissionForPlan(rates, 'other')).toBe(0)
  })
  it('expiryFromNow adds 30-day months', () => {
    expect(expiryFromNow(0, 3)).toBe(3 * 30 * 86_400_000)
  })
})
```

Run — Expected: FAIL.

- [ ] **Step 2: Implement**

`src/lib/server/promo.ts`:
```ts
export const PROMO_CODE_RE = /^[A-Z0-9]{4,16}$/

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase()
}

export type PromoDoc = {
  code: string
  ownerUid: string
  active: boolean
  createdAt: number
  expiresAt: number
}

export function isPromoUsable(
  doc: PromoDoc | undefined,
  nowMillis: number,
): { ok: true } | { ok: false; reason: 'not-found' | 'inactive' | 'expired' } {
  if (!doc) return { ok: false, reason: 'not-found' }
  if (!doc.active) return { ok: false, reason: 'inactive' }
  if (nowMillis > doc.expiresAt) return { ok: false, reason: 'expired' }
  return { ok: true }
}

export function discountedPaise(pricePaise: number, discountPct: number): number {
  if (!Number.isInteger(pricePaise) || pricePaise < 0) throw new Error('pricePaise must be non-negative integer')
  if (!Number.isInteger(discountPct) || discountPct < 0 || discountPct > 90) {
    throw new Error('discountPct must be integer 0-90')
  }
  return Math.round((pricePaise * (100 - discountPct)) / 100)
}

export function freeDaysFor(durationMonths: number, discountPct: number): number {
  if (!Number.isInteger(discountPct) || discountPct < 0 || discountPct > 90) {
    throw new Error('discountPct must be integer 0-90')
  }
  return Math.max(0, Math.round((durationMonths * 30 * discountPct) / 100))
}

export function commissionForPlan(rates: { signupPaise: number; perPlan: Record<string, number> }, planId: string): number {
  return rates.perPlan[planId] ?? 0
}

export function expiryFromNow(nowMillis: number, months: number): number {
  return nowMillis + months * 30 * 86_400_000
}
```

- [ ] **Step 3: Verify + Commit** — `pnpm test && pnpm typecheck`; `git add -A && git commit -m "feat: pure promo domain module"`

---

### Task 2: Influencer store

**Files:**
- Create: `src/lib/server/influencer.ts`, `src/lib/server/influencer.test.ts`

**Interfaces:**
- Consumes: `adminDb`, promo module, `getSettings`.
- Produces:
  - `type InfluencerDoc = { status: 'pending' | 'approved' | 'rejected'; socialLinks: string[]; appliedAt: number; decidedAt: number | null; discountPct: number; commissionRates: { signupPaise: number; perPlan: Record<string, number> }; promoCode: string | null }`
  - `applyAsInfluencer(uid: string, socialLinks: string[], nowMillis: number): Promise<void>` — validates 1–5 http(s) URLs; rejects when doc exists with status pending/approved (rejected may re-apply — overwrites); writes doc with defaults `{discountPct: 10, commissionRates: {signupPaise: 0, perPlan: {}}, promoCode: null}`
  - `getInfluencer(uid: string): Promise<InfluencerDoc | null>`
  - `decideInfluencer(uid: string, decision: 'approved' | 'rejected', nowMillis: number): Promise<void>` — only from pending
  - `updateInfluencerRates(uid: string, rates: { discountPct?: number; signupPaise?: number; perPlan?: Record<string, number> }): Promise<void>` — validates pct 0–90 int, paise non-negative ints
  - `changePromoCode(uid: string, rawCode: string, nowMillis: number, expiryMonths: number): Promise<{ code: string; expiresAt: number }>` — approved only; normalize+regex; availability = `promoCodes/{code}` missing; delete old code doc if any; create new `PromoDoc`; update influencer.promoCode
  - `suggestCodes(displayName: string | null, uid: string): string[]` — 3 deterministic suggestions from name/uid (uppercase alnum, padded to ≥4 chars, suffixed '10', '25', 'VIP')
  - `recordReferral(input: { id: string; code: string; ownerUid: string; referredUid: string; type: 'signup' | 'subscription' | 'lifetime'; planId: string | null; commissionPaise: number; nowMillis: number }): Promise<void>` — `referrals/{id}` create-if-absent (idempotent: existing doc → no-op)
  - `getEarnings(uid: string): Promise<{ totalCommissionPaise: number; paidPaise: number; balancePaise: number; referrals: any[]; payouts: any[] }>` — referrals where ownerUid ==, payouts where influencerUid ==, both createdAt/paidAt desc limit 100; sums integer-guarded
  - `recordPayout(influencerUid: string, amountPaise: number, note: string, nowMillis: number): Promise<void>` — positive int, ≤ current balance (throws otherwise)

- [ ] **Step 1: Failing tests**

`src/lib/server/influencer.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { docGet, docSet, docDelete, docCreate, queryGet } = vi.hoisted(() => ({
  docGet: vi.fn(), docSet: vi.fn(), docDelete: vi.fn(), docCreate: vi.fn(), queryGet: vi.fn(),
}))
vi.mock('./firebase-admin', () => ({
  adminDb: () => ({
    doc: (path: string) => ({
      get: () => docGet(path),
      set: (d: unknown, o?: unknown) => docSet(path, d, o),
      delete: () => docDelete(path),
      create: (d: unknown) => docCreate(path, d),
    }),
    collection: () => ({
      where: () => ({ orderBy: () => ({ limit: () => ({ get: queryGet }) }) }),
    }),
  }),
}))

import {
  applyAsInfluencer,
  changePromoCode,
  decideInfluencer,
  getEarnings,
  recordPayout,
  recordReferral,
  suggestCodes,
  updateInfluencerRates,
} from './influencer'

beforeEach(() => {
  vi.clearAllMocks()
  docGet.mockResolvedValue({ exists: false, data: () => undefined })
  queryGet.mockResolvedValue({ docs: [] })
})

describe('applyAsInfluencer', () => {
  it('writes pending application with defaults', async () => {
    await applyAsInfluencer('u1', ['https://instagram.com/x'], 5)
    expect(docSet).toHaveBeenCalledWith(
      'influencers/u1',
      expect.objectContaining({ status: 'pending', discountPct: 10, promoCode: null, appliedAt: 5 }),
      undefined,
    )
  })
  it('rejects invalid links and re-application while pending/approved', async () => {
    await expect(applyAsInfluencer('u1', [], 5)).rejects.toThrow(/link/)
    await expect(applyAsInfluencer('u1', ['notaurl'], 5)).rejects.toThrow(/link/)
    docGet.mockResolvedValue({ exists: true, data: () => ({ status: 'pending' }) })
    await expect(applyAsInfluencer('u1', ['https://x.com/a'], 5)).rejects.toThrow(/already/)
  })
  it('rejected applicant may re-apply', async () => {
    docGet.mockResolvedValue({ exists: true, data: () => ({ status: 'rejected' }) })
    await applyAsInfluencer('u1', ['https://x.com/a'], 9)
    expect(docSet).toHaveBeenCalled()
  })
})

describe('decideInfluencer / updateInfluencerRates', () => {
  it('approves only from pending', async () => {
    docGet.mockResolvedValue({ exists: true, data: () => ({ status: 'pending' }) })
    await decideInfluencer('u1', 'approved', 7)
    expect(docSet).toHaveBeenCalledWith('influencers/u1', { status: 'approved', decidedAt: 7 }, { merge: true })
    docGet.mockResolvedValue({ exists: true, data: () => ({ status: 'approved' }) })
    await expect(decideInfluencer('u1', 'approved', 8)).rejects.toThrow(/pending/)
  })
  it('validates rates', async () => {
    await updateInfluencerRates('u1', { discountPct: 20, signupPaise: 500, perPlan: { p1: 1000 } })
    expect(docSet).toHaveBeenCalledWith(
      'influencers/u1',
      { discountPct: 20, 'commissionRates.signupPaise': 500, 'commissionRates.perPlan': { p1: 1000 } },
      { merge: true },
    )
    await expect(updateInfluencerRates('u1', { discountPct: 95 })).rejects.toThrow(/discountPct/)
    await expect(updateInfluencerRates('u1', { signupPaise: -5 })).rejects.toThrow(/signupPaise/)
    await expect(updateInfluencerRates('u1', { perPlan: { p1: 10.5 } })).rejects.toThrow(/perPlan/)
  })
})

describe('changePromoCode', () => {
  it('approved influencer claims available code, old deleted', async () => {
    docGet.mockImplementation(async (path: string) => {
      if (path === 'influencers/u1') return { exists: true, data: () => ({ status: 'approved', promoCode: 'OLD1' }) }
      if (path === 'promoCodes/NEW42') return { exists: false }
      return { exists: false }
    })
    const res = await changePromoCode('u1', ' new42 ', 1000, 3)
    expect(res.code).toBe('NEW42')
    expect(docDelete).toHaveBeenCalledWith('promoCodes/OLD1')
    expect(docSet).toHaveBeenCalledWith(
      'promoCodes/NEW42',
      { code: 'NEW42', ownerUid: 'u1', active: true, createdAt: 1000, expiresAt: 1000 + 3 * 30 * 86_400_000 },
      undefined,
    )
    expect(docSet).toHaveBeenCalledWith('influencers/u1', { promoCode: 'NEW42' }, { merge: true })
  })
  it('rejects taken code, bad shape, non-approved', async () => {
    docGet.mockImplementation(async (path: string) => {
      if (path === 'influencers/u1') return { exists: true, data: () => ({ status: 'approved', promoCode: null }) }
      return { exists: true, data: () => ({ ownerUid: 'other' }) }
    })
    await expect(changePromoCode('u1', 'TAKEN1', 1, 3)).rejects.toThrow(/taken/)
    await expect(changePromoCode('u1', 'x', 1, 3)).rejects.toThrow(/code/)
    docGet.mockImplementation(async (path: string) =>
      path === 'influencers/u1' ? { exists: true, data: () => ({ status: 'pending' }) } : { exists: false },
    )
    await expect(changePromoCode('u1', 'GOOD42', 1, 3)).rejects.toThrow(/approved/)
  })
})

describe('suggestCodes', () => {
  it('returns 3 valid distinct codes', () => {
    const s = suggestCodes('Akshay U', 'uid12345')
    expect(s).toHaveLength(3)
    for (const c of s) expect(c).toMatch(/^[A-Z0-9]{4,16}$/)
    expect(new Set(s).size).toBe(3)
  })
  it('works with null name', () => {
    for (const c of suggestCodes(null, 'uid12345')) expect(c).toMatch(/^[A-Z0-9]{4,16}$/)
  })
})

describe('recordReferral / earnings / payout', () => {
  it('recordReferral is create-if-absent', async () => {
    docGet.mockResolvedValue({ exists: true, data: () => ({}) })
    await recordReferral({ id: 'pay-p1', code: 'C', ownerUid: 'u1', referredUid: 'u2', type: 'subscription', planId: 'p', commissionPaise: 100, nowMillis: 1 })
    expect(docSet).not.toHaveBeenCalled()
    docGet.mockResolvedValue({ exists: false })
    await recordReferral({ id: 'pay-p1', code: 'C', ownerUid: 'u1', referredUid: 'u2', type: 'subscription', planId: 'p', commissionPaise: 100, nowMillis: 1 })
    expect(docSet).toHaveBeenCalledWith('referrals/pay-p1', expect.objectContaining({ commissionPaise: 100 }), undefined)
  })
  it('earnings sums and balances', async () => {
    queryGet
      .mockResolvedValueOnce({ docs: [{ id: 'r1', data: () => ({ commissionPaise: 300 }) }, { id: 'r2', data: () => ({ commissionPaise: 200 }) }] })
      .mockResolvedValueOnce({ docs: [{ id: 'po1', data: () => ({ amountPaise: 100 }) }] })
    const e = await getEarnings('u1')
    expect(e.totalCommissionPaise).toBe(500)
    expect(e.paidPaise).toBe(100)
    expect(e.balancePaise).toBe(400)
  })
  it('payout cannot exceed balance', async () => {
    queryGet
      .mockResolvedValueOnce({ docs: [{ id: 'r1', data: () => ({ commissionPaise: 300 }) }] })
      .mockResolvedValueOnce({ docs: [] })
    await expect(recordPayout('u1', 500, 'upi', 1)).rejects.toThrow(/balance/)
  })
})
```

Run — Expected: FAIL.

- [ ] **Step 2: Implement**

`src/lib/server/influencer.ts`:
```ts
import { adminDb } from './firebase-admin'
import { expiryFromNow, normalizeCode, PROMO_CODE_RE } from './promo'

export type InfluencerDoc = {
  status: 'pending' | 'approved' | 'rejected'
  socialLinks: string[]
  appliedAt: number
  decidedAt: number | null
  discountPct: number
  commissionRates: { signupPaise: number; perPlan: Record<string, number> }
  promoCode: string | null
}

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export async function applyAsInfluencer(uid: string, socialLinks: string[], nowMillis: number): Promise<void> {
  if (!Array.isArray(socialLinks) || socialLinks.length < 1 || socialLinks.length > 5 || !socialLinks.every(isHttpUrl)) {
    throw new Error('provide 1-5 valid social links (http/https URLs)')
  }
  const snap = await adminDb().doc(`influencers/${uid}`).get()
  const status = snap.exists ? (snap.data() as InfluencerDoc).status : null
  if (status === 'pending' || status === 'approved') throw new Error('application already exists')
  const doc: InfluencerDoc = {
    status: 'pending',
    socialLinks,
    appliedAt: nowMillis,
    decidedAt: null,
    discountPct: 10,
    commissionRates: { signupPaise: 0, perPlan: {} },
    promoCode: null,
  }
  await adminDb().doc(`influencers/${uid}`).set(doc)
}

export async function getInfluencer(uid: string): Promise<InfluencerDoc | null> {
  const snap = await adminDb().doc(`influencers/${uid}`).get()
  return snap.exists ? (snap.data() as InfluencerDoc) : null
}

export async function decideInfluencer(uid: string, decision: 'approved' | 'rejected', nowMillis: number): Promise<void> {
  const snap = await adminDb().doc(`influencers/${uid}`).get()
  if (!snap.exists || (snap.data() as InfluencerDoc).status !== 'pending') {
    throw new Error('only pending applications can be decided')
  }
  await adminDb().doc(`influencers/${uid}`).set({ status: decision, decidedAt: nowMillis }, { merge: true })
}

export async function updateInfluencerRates(
  uid: string,
  rates: { discountPct?: number; signupPaise?: number; perPlan?: Record<string, number> },
): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (rates.discountPct !== undefined) {
    if (!Number.isInteger(rates.discountPct) || rates.discountPct < 0 || rates.discountPct > 90) {
      throw new Error('discountPct must be integer 0-90')
    }
    patch.discountPct = rates.discountPct
  }
  if (rates.signupPaise !== undefined) {
    if (!Number.isInteger(rates.signupPaise) || rates.signupPaise < 0) throw new Error('signupPaise must be non-negative integer')
    patch['commissionRates.signupPaise'] = rates.signupPaise
  }
  if (rates.perPlan !== undefined) {
    for (const [planId, paise] of Object.entries(rates.perPlan)) {
      if (!Number.isInteger(paise) || paise < 0) throw new Error(`perPlan.${planId} must be non-negative integer`)
    }
    patch['commissionRates.perPlan'] = rates.perPlan
  }
  if (Object.keys(patch).length === 0) throw new Error('empty rates patch')
  await adminDb().doc(`influencers/${uid}`).set(patch, { merge: true })
}

export async function changePromoCode(
  uid: string,
  rawCode: string,
  nowMillis: number,
  expiryMonths: number,
): Promise<{ code: string; expiresAt: number }> {
  const code = normalizeCode(rawCode)
  if (!PROMO_CODE_RE.test(code)) throw new Error('code must be 4-16 letters/numbers')
  const inf = await getInfluencer(uid)
  if (!inf || inf.status !== 'approved') throw new Error('approved influencers only')
  const existing = await adminDb().doc(`promoCodes/${code}`).get()
  if (existing.exists) throw new Error('code already taken')
  if (inf.promoCode) await adminDb().doc(`promoCodes/${inf.promoCode}`).delete()
  const expiresAt = expiryFromNow(nowMillis, expiryMonths)
  await adminDb().doc(`promoCodes/${code}`).set({ code, ownerUid: uid, active: true, createdAt: nowMillis, expiresAt })
  await adminDb().doc(`influencers/${uid}`).set({ promoCode: code }, { merge: true })
  return { code, expiresAt }
}

export function suggestCodes(displayName: string | null, uid: string): string[] {
  const base = (displayName ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8)
  const fallback = uid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8)
  const stem = (base.length >= 4 ? base : (base + fallback + 'LOOP')).slice(0, 8).padEnd(4, 'X')
  return [`${stem}10`, `${stem}25`, `${stem}VIP`].map((c) => c.slice(0, 16))
}

export async function recordReferral(input: {
  id: string
  code: string
  ownerUid: string
  referredUid: string
  type: 'signup' | 'subscription' | 'lifetime'
  planId: string | null
  commissionPaise: number
  nowMillis: number
}): Promise<void> {
  const ref = adminDb().doc(`referrals/${input.id}`)
  if ((await ref.get()).exists) return
  await ref.set({
    code: input.code,
    ownerUid: input.ownerUid,
    referredUid: input.referredUid,
    type: input.type,
    planId: input.planId,
    commissionPaise: input.commissionPaise,
    createdAt: input.nowMillis,
  })
}

export async function getEarnings(uid: string) {
  const db = adminDb()
  const refSnap = await db.collection('referrals').where('ownerUid', '==', uid).orderBy('createdAt', 'desc').limit(100).get()
  const paySnap = await db.collection('payouts').where('influencerUid', '==', uid).orderBy('paidAt', 'desc').limit(100).get()
  let totalCommissionPaise = 0
  const referrals = refSnap.docs.map((d) => {
    const data = d.data()
    if (Number.isInteger(data.commissionPaise)) totalCommissionPaise += data.commissionPaise
    return { id: d.id, ...data }
  })
  let paidPaise = 0
  const payouts = paySnap.docs.map((d) => {
    const data = d.data()
    if (Number.isInteger(data.amountPaise)) paidPaise += data.amountPaise
    return { id: d.id, ...data }
  })
  return { totalCommissionPaise, paidPaise, balancePaise: totalCommissionPaise - paidPaise, referrals, payouts }
}

export async function recordPayout(influencerUid: string, amountPaise: number, note: string, nowMillis: number): Promise<void> {
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) throw new Error('amountPaise must be positive integer')
  const { balancePaise } = await getEarnings(influencerUid)
  if (amountPaise > balancePaise) throw new Error(`amount exceeds balance (${balancePaise})`)
  await adminDb().doc(`payouts/${influencerUid}-${nowMillis}`).set({ influencerUid, amountPaise, note, paidAt: nowMillis })
}
```

- [ ] **Step 3: Verify + Commit** — `git commit -am "feat: influencer store (apply, rates, promo codes, referrals, payouts)"`

---

### Task 3: Influencer self-service routes

**Files:**
- Create: `src/app/api/influencer/apply/route.ts`, `src/app/api/influencer/me/route.ts`, `src/app/api/influencer/promo-code/route.ts`, `src/app/api/influencer/influencer-routes.test.ts`

**Interfaces:**
- All auth via `requireUser` (401 pattern identical to existing routes), 500 generic catch.
- `POST /api/influencer/apply` body `{socialLinks: string[]}` → `applyAsInfluencer`; validation errors → 400 with message
- `GET /api/influencer/me` → `{ influencer: InfluencerDoc | null, suggestions: string[], earnings: {...} | null }` — earnings only when approved; suggestions from `suggestCodes(email-localpart-or-null, uid)` when approved and promoCode null (else [])
- `POST /api/influencer/promo-code` body `{code}` → `changePromoCode(uid, code, now, settings.promoDefaultExpiryMonths)`; errors → 400 with message

- [ ] **Step 1: Failing tests**

`src/app/api/influencer/influencer-routes.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireUser, applyAsInfluencer, getInfluencer, getEarnings, suggestCodes, changePromoCode, getSettings } = vi.hoisted(() => ({
  requireUser: vi.fn(), applyAsInfluencer: vi.fn(), getInfluencer: vi.fn(), getEarnings: vi.fn(),
  suggestCodes: vi.fn(), changePromoCode: vi.fn(), getSettings: vi.fn(),
}))
vi.mock('@/lib/server/verify-token', () => ({ requireUser, UnauthorizedError: class extends Error { status = 401 } }))
vi.mock('@/lib/server/influencer', () => ({ applyAsInfluencer, getInfluencer, getEarnings, suggestCodes, changePromoCode }))
vi.mock('@/lib/server/settings', () => ({ getSettings }))

import { POST as applyPOST } from './apply/route'
import { GET as meGET } from './me/route'
import { POST as codePOST } from './promo-code/route'

function req(body?: unknown, method = 'POST') {
  return new Request('http://x', { method, ...(body ? { body: JSON.stringify(body) } : {}), headers: { Authorization: 'Bearer t' } })
}

beforeEach(() => {
  vi.clearAllMocks()
  requireUser.mockResolvedValue({ uid: 'u1', email: 'ak@x.com' })
  getSettings.mockResolvedValue({ freeTrialEnabled: false, trialDays: 7, promoDefaultExpiryMonths: 3 })
})

describe('POST /api/influencer/apply', () => {
  it('401 unauth', async () => {
    const { UnauthorizedError } = await import('@/lib/server/verify-token')
    requireUser.mockRejectedValue(new UnauthorizedError('no'))
    expect((await applyPOST(req({ socialLinks: [] }))).status).toBe(401)
  })
  it('applies and 400s on store validation error', async () => {
    expect((await applyPOST(req({ socialLinks: ['https://x.com/a'] }))).status).toBe(200)
    expect(applyAsInfluencer).toHaveBeenCalledWith('u1', ['https://x.com/a'], expect.any(Number))
    applyAsInfluencer.mockRejectedValue(new Error('application already exists'))
    const res = await applyPOST(req({ socialLinks: ['https://x.com/a'] }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/already/)
  })
})

describe('GET /api/influencer/me', () => {
  it('null influencer for non-applicant', async () => {
    getInfluencer.mockResolvedValue(null)
    const res = await meGET(req(undefined, 'GET'))
    expect(await res.json()).toEqual({ influencer: null, suggestions: [], earnings: null })
  })
  it('approved gets earnings + suggestions when no code', async () => {
    getInfluencer.mockResolvedValue({ status: 'approved', promoCode: null })
    getEarnings.mockResolvedValue({ totalCommissionPaise: 0, paidPaise: 0, balancePaise: 0, referrals: [], payouts: [] })
    suggestCodes.mockReturnValue(['AK10', 'AK25', 'AKVIP'])
    const json = await (await meGET(req(undefined, 'GET'))).json()
    expect(json.suggestions).toEqual(['AK10', 'AK25', 'AKVIP'])
    expect(json.earnings.balancePaise).toBe(0)
    expect(suggestCodes).toHaveBeenCalledWith('ak', 'u1')
  })
})

describe('POST /api/influencer/promo-code', () => {
  it('changes code using settings expiry', async () => {
    changePromoCode.mockResolvedValue({ code: 'NEW42', expiresAt: 99 })
    const res = await codePOST(req({ code: 'new42' }))
    expect(res.status).toBe(200)
    expect(changePromoCode).toHaveBeenCalledWith('u1', 'new42', expect.any(Number), 3)
  })
  it('400 with message on store error', async () => {
    changePromoCode.mockRejectedValue(new Error('code already taken'))
    const res = await codePOST(req({ code: 'TAKEN1' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/taken/)
  })
})
```

Run — Expected: FAIL.

- [ ] **Step 2: Implement** (all three follow the same skeleton; email local-part = `email?.split('@')[0] ?? null`)

`src/app/api/influencer/apply/route.ts`:
```ts
import { applyAsInfluencer } from '@/lib/server/influencer'
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
    await applyAsInfluencer(uid, Array.isArray(body.socialLinks) ? body.socialLinks : [], Date.now())
    return Response.json({ ok: true })
  } catch (err) {
    if (err instanceof Error) return Response.json({ error: err.message }, { status: 400 })
    console.error('apply failed', err)
    return Response.json({ error: 'apply failed' }, { status: 500 })
  }
}
```

`src/app/api/influencer/me/route.ts`:
```ts
import { getEarnings, getInfluencer, suggestCodes } from '@/lib/server/influencer'
import { requireUser, UnauthorizedError } from '@/lib/server/verify-token'

export const runtime = 'nodejs'

export async function GET(req: Request): Promise<Response> {
  let uid: string, email: string | null
  try {
    ;({ uid, email } = await requireUser(req))
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'unauthorized' }, { status: 401 })
    throw err
  }
  try {
    const influencer = await getInfluencer(uid)
    if (!influencer) return Response.json({ influencer: null, suggestions: [], earnings: null })
    const approved = influencer.status === 'approved'
    const suggestions = approved && !influencer.promoCode ? suggestCodes(email?.split('@')[0] ?? null, uid) : []
    const earnings = approved ? await getEarnings(uid) : null
    return Response.json({ influencer, suggestions, earnings })
  } catch (err) {
    console.error('influencer me failed', err)
    return Response.json({ error: 'failed' }, { status: 500 })
  }
}
```

`src/app/api/influencer/promo-code/route.ts`:
```ts
import { changePromoCode } from '@/lib/server/influencer'
import { getSettings } from '@/lib/server/settings'
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
    if (typeof body.code !== 'string') return Response.json({ error: 'code required' }, { status: 400 })
    const settings = await getSettings()
    const result = await changePromoCode(uid, body.code, Date.now(), settings.promoDefaultExpiryMonths)
    return Response.json(result)
  } catch (err) {
    if (err instanceof Error) return Response.json({ error: err.message }, { status: 400 })
    console.error('promo code change failed', err)
    return Response.json({ error: 'failed' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verify + Commit** — `git commit -am "feat: influencer apply, me, promo-code routes"`

---

### Task 4: Referral claim + public promo validate + ReferralCatcher

**Files:**
- Create: `src/app/api/referral/claim/route.ts`, `src/app/api/promo/validate/route.ts`, `src/components/referral-catcher.tsx`, `src/app/api/referral/claim/route.test.ts`
- Modify: `src/app/layout.tsx` (mount `<ReferralCatcher />` inside AuthProvider)

**Interfaces:**
- `POST /api/referral/claim` body `{code}` auth — flow: normalize; load `promoCodes/{code}`; `isPromoUsable`; owner = influencer doc (must be approved); reject self-referral (owner uid === caller) 400; `users/{uid}` root doc: if `referredBy` already set → 200 `{claimed:false, reason:'already-referred'}` (idempotent, not an error); else set `{referredBy: code, referredAt: now}` (merge) + `recordReferral({id: 'signup-'+uid, type:'signup', commissionPaise: rates.signupPaise, planId: null, ...})` → `{claimed:true}`
- `GET /api/promo/validate?code=X` — public: `{valid: boolean, discountPct?: number, reason?: string}` (discountPct from owner influencer doc; also used by Android app + pricing UX); Cache-Control no-store
- `ReferralCatcher` (client, renders null): on mount — if `?ref=CODE` in URL, write cookie `il_ref=CODE; max-age=2592000; path=/; SameSite=Lax`; separately, when `user` becomes non-null and cookie exists → POST claim with Bearer, then delete cookie (regardless of outcome; server is idempotent)

- [ ] **Step 1: Failing tests**

`src/app/api/referral/claim/route.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireUser, recordReferral, getInfluencer, docGet, docSet } = vi.hoisted(() => ({
  requireUser: vi.fn(), recordReferral: vi.fn(), getInfluencer: vi.fn(), docGet: vi.fn(), docSet: vi.fn(),
}))
vi.mock('@/lib/server/verify-token', () => ({ requireUser, UnauthorizedError: class extends Error { status = 401 } }))
vi.mock('@/lib/server/influencer', () => ({ recordReferral, getInfluencer }))
vi.mock('@/lib/server/firebase-admin', () => ({
  adminDb: () => ({ doc: (path: string) => ({ get: () => docGet(path), set: (d: unknown, o?: unknown) => docSet(path, d, o) }) }),
}))

import { POST } from './route'

function req(body: unknown) {
  return new Request('http://x', { method: 'POST', body: JSON.stringify(body), headers: { Authorization: 'Bearer t' } })
}

const PROMO = { code: 'AK10X', ownerUid: 'inf1', active: true, createdAt: 0, expiresAt: Date.now() + 10_000_000 }

beforeEach(() => {
  vi.clearAllMocks()
  requireUser.mockResolvedValue({ uid: 'u2', email: null })
  getInfluencer.mockResolvedValue({ status: 'approved', commissionRates: { signupPaise: 500, perPlan: {} } })
  docGet.mockImplementation(async (path: string) => {
    if (path === 'promoCodes/AK10X') return { exists: true, data: () => PROMO }
    if (path === 'users/u2') return { exists: false, data: () => undefined }
    return { exists: false }
  })
})

describe('POST /api/referral/claim', () => {
  it('claims: sets referredBy and records signup commission', async () => {
    const res = await POST(req({ code: 'ak10x' }))
    expect(res.status).toBe(200)
    expect((await res.json()).claimed).toBe(true)
    expect(docSet).toHaveBeenCalledWith('users/u2', expect.objectContaining({ referredBy: 'AK10X' }), { merge: true })
    expect(recordReferral).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'signup-u2', type: 'signup', ownerUid: 'inf1', commissionPaise: 500 }),
    )
  })
  it('idempotent when already referred', async () => {
    docGet.mockImplementation(async (path: string) =>
      path === 'users/u2'
        ? { exists: true, data: () => ({ referredBy: 'OTHER' }) }
        : { exists: true, data: () => PROMO },
    )
    const json = await (await POST(req({ code: 'AK10X' }))).json()
    expect(json.claimed).toBe(false)
    expect(docSet).not.toHaveBeenCalled()
  })
  it('rejects self-referral', async () => {
    requireUser.mockResolvedValue({ uid: 'inf1', email: null })
    expect((await POST(req({ code: 'AK10X' }))).status).toBe(400)
  })
  it('rejects expired/unknown codes', async () => {
    docGet.mockImplementation(async (path: string) =>
      path === 'promoCodes/AK10X' ? { exists: true, data: () => ({ ...PROMO, expiresAt: 1 }) } : { exists: false },
    )
    expect((await POST(req({ code: 'AK10X' }))).status).toBe(400)
    docGet.mockImplementation(async () => ({ exists: false }))
    expect((await POST(req({ code: 'NOPE1' }))).status).toBe(400)
  })
})
```

Run — Expected: FAIL.

- [ ] **Step 2: Implement**

`src/app/api/referral/claim/route.ts`:
```ts
import { adminDb } from '@/lib/server/firebase-admin'
import { getInfluencer, recordReferral } from '@/lib/server/influencer'
import { isPromoUsable, normalizeCode, type PromoDoc } from '@/lib/server/promo'
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
    if (typeof body.code !== 'string') return Response.json({ error: 'code required' }, { status: 400 })
    const code = normalizeCode(body.code)
    const now = Date.now()

    const promoSnap = await adminDb().doc(`promoCodes/${code}`).get()
    const promo = promoSnap.exists ? (promoSnap.data() as PromoDoc) : undefined
    const usable = isPromoUsable(promo, now)
    if (!usable.ok) return Response.json({ error: `code ${usable.reason}` }, { status: 400 })
    if (promo!.ownerUid === uid) return Response.json({ error: 'cannot use your own code' }, { status: 400 })

    const owner = await getInfluencer(promo!.ownerUid)
    if (!owner || owner.status !== 'approved') return Response.json({ error: 'code inactive' }, { status: 400 })

    const userSnap = await adminDb().doc(`users/${uid}`).get()
    if (userSnap.exists && userSnap.data()?.referredBy) {
      return Response.json({ claimed: false, reason: 'already-referred' })
    }

    await adminDb().doc(`users/${uid}`).set({ referredBy: code, referredAt: now }, { merge: true })
    await recordReferral({
      id: `signup-${uid}`,
      code,
      ownerUid: promo!.ownerUid,
      referredUid: uid,
      type: 'signup',
      planId: null,
      commissionPaise: owner.commissionRates.signupPaise,
      nowMillis: now,
    })
    return Response.json({ claimed: true })
  } catch (err) {
    console.error('referral claim failed', err)
    return Response.json({ error: 'claim failed' }, { status: 500 })
  }
}
```

`src/app/api/promo/validate/route.ts`:
```ts
import { adminDb } from '@/lib/server/firebase-admin'
import { getInfluencer } from '@/lib/server/influencer'
import { isPromoUsable, normalizeCode, type PromoDoc } from '@/lib/server/promo'

export const runtime = 'nodejs'

export async function GET(req: Request): Promise<Response> {
  const raw = new URL(req.url).searchParams.get('code')
  if (!raw) return Response.json({ valid: false, reason: 'code required' }, { status: 400 })
  try {
    const code = normalizeCode(raw)
    const snap = await adminDb().doc(`promoCodes/${code}`).get()
    const promo = snap.exists ? (snap.data() as PromoDoc) : undefined
    const usable = isPromoUsable(promo, Date.now())
    if (!usable.ok) return Response.json({ valid: false, reason: usable.reason }, { headers: { 'Cache-Control': 'no-store' } })
    const owner = await getInfluencer(promo!.ownerUid)
    if (!owner || owner.status !== 'approved') {
      return Response.json({ valid: false, reason: 'inactive' }, { headers: { 'Cache-Control': 'no-store' } })
    }
    return Response.json({ valid: true, discountPct: owner.discountPct }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('promo validate failed', err)
    return Response.json({ valid: false, reason: 'error' }, { status: 500 })
  }
}
```

`src/components/referral-catcher.tsx`:
```tsx
'use client'
import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export function ReferralCatcher() {
  const { user } = useAuth()

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref) {
      document.cookie = `il_ref=${encodeURIComponent(ref)}; max-age=2592000; path=/; SameSite=Lax`
    }
  }, [])

  useEffect(() => {
    if (!user) return
    const code = getCookie('il_ref')
    if (!code) return
    void (async () => {
      try {
        const token = await user.getIdToken()
        await fetch('/api/referral/claim', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })
      } finally {
        document.cookie = 'il_ref=; max-age=0; path=/'
      }
    })()
  }, [user])

  return null
}
```

In `src/app/layout.tsx`: render `<ReferralCatcher />` as first child inside `<AuthProvider>`.

- [ ] **Step 3: Verify + Commit** — `pnpm test && pnpm typecheck && pnpm build`; `git commit -am "feat: referral claim, promo validation api, ref-link capture"`

---

### Task 5: Checkout promo integration

**Files:**
- Modify: `src/app/api/checkout/route.ts`, `src/app/api/checkout/route.test.ts`

**Interfaces:**
- `POST /api/checkout` body gains optional `promoCode: string`. New flow when present: normalize → load promo → `isPromoUsable` → owner influencer approved → reject own code (400) →
  - **lifetime:** `amount = discountedPaise(plan.pricePaise, owner.discountPct)`; order notes gain `{promoCode: code, promoOwnerUid: ownerUid, discountPct: String(pct)}`; order doc gains `{promoCode: code, promoOwnerUid, discountedPaise: amount}` (order doc `amountPaise` = DISCOUNTED amount — verify route + webhook already read it for payment records)
  - **recurring:** subscription created with extra param `start_at` = `Math.floor((now + freeDaysFor(durationMonths, pct) * 86_400_000) / 1000)` (razorpay wants unix seconds; only when freeDays > 0); notes gain promo fields; `razorpaySubscriptions/{subId}` index doc gains `{promoCode: code, promoOwnerUid: ownerUid}`
  - invalid promo → 400 `{error: 'promo ' + reason}` — checkout NEVER silently drops a bad code
- `createSubscription` in razorpay.ts gains optional `startAtUnix?: number` → adds `start_at` to POST body when present (extend existing test)
- Response gains `promo: { code, discountPct, freeDays } | null` for client display.

- [ ] **Step 1: Extend tests** (`src/app/api/checkout/route.test.ts` — add to existing describe, keep old tests untouched; add mocks for `@/lib/server/influencer` getInfluencer and extend firebase-admin docGet path map for promoCodes)

```ts
// new hoisted mock: getInfluencer; vi.mock('@/lib/server/influencer', () => ({ getInfluencer }))
// promo doc path: docGet('promoCodes/AK10X') → { exists: true, data: () => ({ code: 'AK10X', ownerUid: 'inf1', active: true, createdAt: 0, expiresAt: Date.now() + 1e9 }) }
// getInfluencer.mockResolvedValue({ status: 'approved', discountPct: 10, commissionRates: { signupPaise: 0, perPlan: {} } })

it('lifetime with promo: order amount is discounted, promo recorded on order doc', async () => {
  getPlanById.mockResolvedValue({ ...PLAN, id: 'life', lifetime: true, durationMonths: null, pricePaise: 199900, razorpayPlanId: null })
  createOrder.mockResolvedValue({ id: 'order_1', amount: 179910 })
  const res = await POST(req({ planId: 'life', promoCode: 'ak10x' }))
  expect(res.status).toBe(200)
  expect(createOrder).toHaveBeenCalledWith(expect.objectContaining({ amountPaise: 179910 }))
  expect(docSet).toHaveBeenCalledWith('orders/order_1', expect.objectContaining({ amountPaise: 179910, promoCode: 'AK10X', promoOwnerUid: 'inf1' }))
  expect((await res.json()).promo).toEqual({ code: 'AK10X', discountPct: 10, freeDays: 0 })
})

it('recurring with promo: start_at delay and promo on index doc', async () => {
  getPlanById.mockResolvedValue(PLAN) // 1-month plan, razorpayPlanId plan_x
  createSubscription.mockResolvedValue({ id: 'sub_9', status: 'created' })
  const res = await POST(req({ planId: PLAN.id, promoCode: 'AK10X' }))
  expect(res.status).toBe(200)
  const call = createSubscription.mock.calls[0][0]
  expect(call.startAtUnix).toBeGreaterThan(Math.floor(Date.now() / 1000) + 2 * 86400) // ~3 free days
  expect(docSet).toHaveBeenCalledWith('razorpaySubscriptions/sub_9', expect.objectContaining({ promoCode: 'AK10X', promoOwnerUid: 'inf1' }))
  expect((await res.json()).promo).toEqual({ code: 'AK10X', discountPct: 10, freeDays: 3 })
})

it('400 on invalid promo, own code, unapproved owner', async () => {
  getPlanById.mockResolvedValue(PLAN)
  expect((await POST(req({ planId: PLAN.id, promoCode: 'NOPE1' }))).status).toBe(400)
  requireUser.mockResolvedValue({ uid: 'inf1', email: null })
  expect((await POST(req({ planId: PLAN.id, promoCode: 'AK10X' }))).status).toBe(400)
  requireUser.mockResolvedValue({ uid: 'u1', email: null })
  getInfluencer.mockResolvedValue({ status: 'pending', discountPct: 10, commissionRates: { signupPaise: 0, perPlan: {} } })
  expect((await POST(req({ planId: PLAN.id, promoCode: 'AK10X' }))).status).toBe(400)
})
```

REMOVE the old `400 when promoCode present` test (behavior replaced).

- [ ] **Step 2: Implement** — in checkout route, replace the promoCode rejection block with:

```ts
let promo: { code: string; ownerUid: string; discountPct: number } | null = null
if (body.promoCode !== undefined) {
  if (typeof body.promoCode !== 'string') return Response.json({ error: 'invalid promo code' }, { status: 400 })
  const code = normalizeCode(body.promoCode)
  const promoSnap = await adminDb().doc(`promoCodes/${code}`).get()
  const promoDoc = promoSnap.exists ? (promoSnap.data() as PromoDoc) : undefined
  const usable = isPromoUsable(promoDoc, Date.now())
  if (!usable.ok) return Response.json({ error: `promo ${usable.reason}` }, { status: 400 })
  if (promoDoc!.ownerUid === uid) return Response.json({ error: 'cannot use your own code' }, { status: 400 })
  const owner = await getInfluencer(promoDoc!.ownerUid)
  if (!owner || owner.status !== 'approved') return Response.json({ error: 'promo inactive' }, { status: 400 })
  promo = { code, ownerUid: promoDoc!.ownerUid, discountPct: owner.discountPct }
}
```
Then thread `promo` through both branches per the Interfaces block (lifetime: `discountedPaise`; recurring: `freeDaysFor` + `startAtUnix`; notes + docs + response `promo` field). `createSubscription` signature: `{ razorpayPlanId, totalCount, notes, startAtUnix? }` → body gains `...(input.startAtUnix ? { start_at: input.startAtUnix } : {})`; add razorpay.test.ts case asserting `start_at` present when given, absent otherwise.

- [ ] **Step 3: Verify + Commit** — full suite green; `git commit -am "feat: promo codes at checkout (lifetime discount, recurring free days)"`

---

### Task 6: Commission recording on payment

**Files:**
- Modify: `src/app/api/razorpay/webhook/route.ts` + test, `src/app/api/checkout/verify/route.ts` + test

**Interfaces:**
- Webhook `subscription-update` branch: after entitlement write, when the index doc (`razorpaySubscriptions/{subId}`) carries `promoCode` + `promoOwnerUid` AND `effect.paymentId` present (i.e., a real charge): load owner influencer, `commissionForPlan(rates, planId)`; if > 0 → `recordReferral({ id: 'pay-' + effect.paymentId, type: 'subscription', code, ownerUid, referredUid: ctx.uid, planId, commissionPaise, nowMillis })`. Idempotency: recordReferral is create-if-absent + webhook marker already guards.
- Verify route (lifetime): after grant, when order doc carries `promoCode` + `promoOwnerUid` → same recording with `id: 'pay-' + paymentId`, `type: 'lifetime'`.
- Webhook `order-paid` backup path: same recording (identical referral id ⇒ idempotent against verify-route recording).
- Owner missing/not-approved at payment time → skip recording, `console.warn` (payment still processed).

- [ ] **Step 1: Extend tests**

Webhook test additions (mock `@/lib/server/influencer` with `getInfluencer` + `recordReferral`):
```ts
it('charged with promo on index doc records commission', async () => {
  getInfluencer.mockResolvedValue({ status: 'approved', discountPct: 10, commissionRates: { signupPaise: 0, perPlan: { 'crackloop-pro-1m': 1500 } } })
  docGet.mockImplementation(async (path: string) => {
    if (path === 'webhookEvents/evt_7') return { exists: false }
    if (path === 'razorpaySubscriptions/sub_1')
      return { exists: true, data: () => ({ uid: 'u1', appId: 'crackloop', planId: 'crackloop-pro-1m', promoCode: 'AK10X', promoOwnerUid: 'inf1' }) }
    return { exists: false, data: () => undefined }
  })
  await POST(signed(CHARGED, 'evt_7'))
  expect(recordReferral).toHaveBeenCalledWith(expect.objectContaining({
    id: 'pay-pay_1', type: 'subscription', ownerUid: 'inf1', referredUid: 'u1', commissionPaise: 1500,
  }))
})

it('zero-rate plan records nothing; unapproved owner skips with warn', async () => {
  getInfluencer.mockResolvedValue({ status: 'approved', discountPct: 10, commissionRates: { signupPaise: 0, perPlan: {} } })
  // ...same promo index doc, evt_8 → expect recordReferral NOT called
  getInfluencer.mockResolvedValue({ status: 'rejected', discountPct: 10, commissionRates: { signupPaise: 0, perPlan: { 'crackloop-pro-1m': 1500 } } })
  // evt_9 → expect recordReferral NOT called
})
```
Verify-route test addition: order doc with `{promoCode:'AK10X', promoOwnerUid:'inf1'}` → grants AND `recordReferral` called with `{id:'pay-pay_1', type:'lifetime', commissionPaise: <perPlan lookup>}`.

- [ ] **Step 2: Implement** per Interfaces (small additions to both routes; helper duplicated inline is fine at this size, or shared `maybeRecordCommission()` in influencer.ts if cleaner).
- [ ] **Step 3: Verify + Commit** — `git commit -am "feat: webhook-confirmed commission recording"`

---

### Task 7: Admin influencer API

**Files:**
- Create: `src/app/api/admin/influencers/route.ts`, `src/app/api/admin/influencers/[uid]/route.ts`, `src/app/api/admin/influencers/influencers-admin.test.ts`

**Interfaces:**
- `GET /api/admin/influencers` → `{ influencers: Array<{ uid, status, socialLinks, appliedAt, promoCode, discountPct, commissionRates, email }> }` — list `influencers` collection (limit 200), join email via `adminAuth().getUser(uid).catch(() => null)`
- `POST /api/admin/influencers/[uid]` body `{action}`:
  - `{action:'approve'|'reject'}` → `decideInfluencer` (store errors → 400)
  - `{action:'update-rates', discountPct?, signupPaise?, perPlan?}` → `updateInfluencerRates`
  - `{action:'mark-paid', amountPaise, note}` → `recordPayout` (balance errors → 400)
  - `{action:'earnings'}` → returns `getEarnings(uid)` (POST for uniformity)
  - unknown → 400
- All via `withAdmin`.

- [ ] **Step 1: Failing tests** (same pattern as admin-routes.test.ts: hoisted mocks for require-admin/influencer store; guard matrix 401/403 on list route; one test per action asserting store call + status; validation error → 400)

```ts
// key assertions:
it('approve calls decideInfluencer', async () => { /* action:'approve' → decideInfluencer('inf1','approved',now) → 200 */ })
it('update-rates forwards fields', async () => { /* → updateInfluencerRates('inf1', {discountPct:15, signupPaise:500, perPlan:{p1:1000}}) */ })
it('mark-paid respects balance error', async () => { recordPayout.mockRejectedValue(new Error('amount exceeds balance (400)')); /* → 400 with message */ })
it('earnings action returns summary', async () => { /* getEarnings → 200 body */ })
it('unknown action 400', async () => {})
it('list joins emails', async () => { /* collection('influencers').limit(200).get() docs + adminAuth().getUser */ })
```

- [ ] **Step 2: Implement** (same `withAdmin` skeleton as other admin routes; store errors mapped to 400 via `err instanceof Error`).
- [ ] **Step 3: Verify + Commit** — `git commit -am "feat: admin influencer approval, rates, payout api"`

---

### Task 8: Influencer portal UI

**Files:**
- Create: `src/app/influencer/page.tsx` (3-line wrapper), `src/components/influencer-portal.tsx`
- Modify: `src/components/nav.tsx` — AuthButton area unchanged; add "Influencer" link ONLY inside the mobile menu + desktop links? NO — keep nav clean: the portal is linked from /account (next task adds the card). No nav change in this task.

**Interfaces:** `InfluencerPortal` client component consuming `/api/influencer/me` + `/api/influencer/promo-code`:
- Signed out → sign-in Card (like AdminGate's)
- No application → intro Card + "Apply from your account page" link `/account`
- pending → status Card "Application under review"; rejected → Card with re-apply pointer to /account
- approved →
  1. Promo code Card: current code + share link `https://<origin>/?ref=CODE` with copy button (`navigator.clipboard.writeText`), OR when no code: 3 suggestion buttons + custom code Input, POST on pick, `role="alert"` errors
  2. Earnings Cards row: balance / total earned / paid out (formatINR)
  3. Referrals Table (date, type, plan, commission) + payouts list
- Loading/error/retry states throughout (same pattern as admin components).

- [ ] **Step 1: Implement** (client component ~200 lines, follow admin components' fetch/state pattern exactly; `adminFetch` is generic — reuse it (it just adds Bearer): import from `@/components/admin/admin-fetch`).
- [ ] **Step 2: Verify** — `pnpm test && pnpm typecheck && pnpm build`; /influencer listed.
- [ ] **Step 3: Commit** — `git commit -am "feat: influencer portal (code manager, earnings, referrals)"`

---

### Task 9: Remaining UI — admin influencers page, account apply card, pricing promo input

**Files:**
- Create: `src/app/admin/influencers/page.tsx`, `src/components/admin/influencers.tsx`, `src/components/promo-input.tsx`
- Modify: `src/app/admin/layout.tsx` (add `{ href: '/admin/influencers', label: 'Influencers' }` after Users), `src/app/account/account-view.tsx` (influencer card), `src/components/plan-card.tsx` + `src/components/checkout-button.tsx` (promo input wiring)

**Interfaces:**
- `AdminInfluencers` (client): list with status Badge; pending → Approve/Reject buttons (reject behind ConfirmModal); approved → rates editor (discountPct, signupPaise ₹-input×100, perPlan: one ₹-input per ACTIVE plan fetched from `/api/admin/plans`), Save → update-rates; earnings expander (POST earnings action) showing balance + Mark paid form (amount ₹, note) behind ConfirmModal
- Account view: new Card "Influencer program" — if no application: 1–5 social link inputs (start with 1, "+ add link") + Apply button → POST `/api/influencer/apply`; if pending/rejected/approved: status line + link to `/influencer`
- `PromoInput`: small client component `{ onApply(code: string | null): void }` — Input + Apply button → GET `/api/promo/validate?code=` → valid: shows "✓ CODE — N% off / N free days" (green `role="status"`) and calls `onApply(code)`; invalid: `role="alert"` reason, `onApply(null)`
- `PlanCard`: renders `<CheckoutButton plan={plan} />` unchanged, but CheckoutButton now internally renders PromoInput above the button and sends `promoCode` in the POST body when applied. 409/400 promo errors surface in existing error line.

- [ ] **Step 1: Implement** all per patterns established (admin component fetch/state style; ConfirmModal for destructive; ₹→paise via Math.round(Number(x)*100)).
- [ ] **Step 2: Verify** — full suite + typecheck + build; existing checkout-button tests still pass (promo input renders but tests target button by role/name — if any break, update ONLY selectors, never assertions' meaning).
- [ ] **Step 3: Commit** — `git commit -am "feat: admin influencer management, apply flow, promo input at checkout"`

---

### Task 10: Docs + final verification

**Files:**
- Modify: `README.md`, `docs/BILLING-TEST-GATE.md`

- [ ] **Step 1:** README: add influencer program to highlights ("Influencer program: applications, admin-set commission rates, promo codes (lifetime discounts / free days on subscriptions), referral attribution, manual payouts."). Keep truthful.
- [ ] **Step 2:** Append influencer gate to `docs/BILLING-TEST-GATE.md`:
```markdown

## Influencer gate

| # | Flow | Steps | Expect |
|---|------|-------|--------|
| I1 | Apply | user B /account → apply with instagram link | /influencer shows "under review" |
| I2 | Approve + rates | admin /admin/influencers → approve B, discount 10%, signup ₹5, pro-1m ₹15 | B's /influencer unlocks code manager |
| I3 | Code claim | B picks suggestion or custom | code registered; share link shown; changing code kills old one (validate API says not-found) |
| I4 | Referral signup | incognito: open share link → sign in as NEW user C | C's users doc referredBy=code; B sees signup referral ₹5 |
| I5 | Promo checkout (lifetime) | C buys lifetime with code | pays 10% less; B gets lifetime commission after payment |
| I6 | Promo checkout (recurring) | C subscribes 1m with code | Razorpay shows first charge ~3 days out (free days); after charge webhook, B sees subscription commission ₹15 |
| I7 | Self-use blocked | B tries own code at checkout | 400 "cannot use your own code" |
| I8 | Payout | admin marks ₹20 paid to B | B's balance drops by ₹20; cannot mark more than balance |
| I9 | Expiry | admin sets promoDefaultExpiryMonths=1 in settings; B re-creates code | new expiry ~30 days out |
```
- [ ] **Step 3:** `pnpm test && pnpm typecheck && pnpm build` all green.
- [ ] **Step 4: Commit** — `git commit -am "docs: influencer program shipped + manual gate"`

---

## Out of scope (recorded for future)
- Literal first-cycle price cut on recurring subs (needs dashboard-managed Razorpay Offers; `offerId` seam reserved)
- Automated payouts, GST/TDS on commissions
- Influencer analytics beyond referral list (click tracking, conversion funnels)
- Promo code redemption caps (maxRedemptions) — add when a real influencer asks
