import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireUser, getPlanById, createSubscription, createOrder, entitlementGet, docSet } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getPlanById: vi.fn(),
  createSubscription: vi.fn(),
  createOrder: vi.fn(),
  entitlementGet: vi.fn(),
  docSet: vi.fn(),
}))

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
