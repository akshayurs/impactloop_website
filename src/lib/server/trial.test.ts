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
