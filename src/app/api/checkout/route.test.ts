import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireUser, getPlanById, createSubscription, createOrder, getInfluencer, entitlementGet, docSet, docGet } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getPlanById: vi.fn(),
  createSubscription: vi.fn(),
  createOrder: vi.fn(),
  getInfluencer: vi.fn(),
  entitlementGet: vi.fn(),
  docSet: vi.fn(),
  docGet: vi.fn(),
}))

vi.mock('@/lib/server/verify-token', () => ({
  requireUser,
  UnauthorizedError: class extends Error { status = 401 },
}))
vi.mock('@/lib/server/plans-store', () => ({ getPlanById }))
vi.mock('@/lib/server/influencer', () => ({ getInfluencer }))
vi.mock('@/lib/server/razorpay', () => ({
  createSubscription,
  createOrder,
  RazorpayError: class extends Error { constructor(m: string, public status: number) { super(m) } },
}))
vi.mock('@/lib/server/firebase-admin', () => ({
  adminDb: () => ({
    doc: (path: string) => {
      if (path.startsWith('promoCodes/')) return { get: () => docGet(path) }
      return {
        get: () => entitlementGet(path),
        set: (data: unknown) => docSet(path, data),
      }
    },
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
    docGet.mockImplementation(async (path: string) => {
      if (path === 'promoCodes/AK10X')
        return { exists: true, data: () => ({ code: 'AK10X', ownerUid: 'inf1', active: true, createdAt: 0, expiresAt: Date.now() + 1e9 }) }
      return { exists: false, data: () => undefined }
    })
    getInfluencer.mockResolvedValue({ status: 'approved', discountPct: 10, commissionRates: { signupPaise: 0, perPlan: {} } })
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
    getPlanById.mockResolvedValue(PLAN)
    createSubscription.mockResolvedValue({ id: 'sub_9', status: 'created' })
    const res = await POST(req({ planId: PLAN.id, promoCode: 'AK10X' }))
    expect(res.status).toBe(200)
    const call = createSubscription.mock.calls[0][0]
    expect(call.startAtUnix).toBeGreaterThan(Math.floor(Date.now() / 1000) + 2 * 86400)
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
})
