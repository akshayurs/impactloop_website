import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireUser, cancelSubscriptionAtCycleEnd, docGet, docSet } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  cancelSubscriptionAtCycleEnd: vi.fn(),
  docGet: vi.fn(),
  docSet: vi.fn(),
}))

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
