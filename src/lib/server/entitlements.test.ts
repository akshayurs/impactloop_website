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
