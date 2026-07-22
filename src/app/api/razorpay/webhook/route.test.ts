import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { writeEntitlement, clearEntitlement, getPlanById, docGet, docSet, getEnrollment, recordReferral, reverseReferral, creditSignupCommission, orderQueryGet } = vi.hoisted(() => ({
  writeEntitlement: vi.fn(),
  clearEntitlement: vi.fn(),
  getPlanById: vi.fn(),
  docGet: vi.fn(),
  docSet: vi.fn(),
  getEnrollment: vi.fn(),
  recordReferral: vi.fn(),
  reverseReferral: vi.fn(),
  creditSignupCommission: vi.fn(),
  orderQueryGet: vi.fn(),
}))

vi.mock('@/lib/server/entitlements', async (importOriginal) => {
  const actual: any = await importOriginal()
  return { ...actual, writeEntitlement, clearEntitlement }
})
vi.mock('@/lib/server/plans-store', () => ({ getPlanById }))
vi.mock('@/lib/server/influencer', () => ({ recordReferral, reverseReferral }))
vi.mock('@/lib/server/influencer-apps', () => ({ getEnrollment }))
vi.mock('@/lib/server/commission', () => ({ creditSignupCommission }))
vi.mock('@/lib/server/firebase-admin', () => ({
  adminDb: () => {
    const query: any = { where: () => query, limit: () => query, get: () => orderQueryGet() }
    return {
      doc: (path: string) => ({ get: () => docGet(path), set: (d: unknown, o?: unknown) => docSet(path, d, o) }),
      collection: () => query,
    }
  },
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
    getEnrollment.mockResolvedValue(null)
    orderQueryGet.mockResolvedValue({ docs: [] })
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
      entitlements: { adFree: true, unlimitedAi: false, tier: 'pro' },
    }))
    expect(docSet).toHaveBeenCalledWith('users/u1/payments/pay_1', expect.objectContaining({ amountPaise: 7900, type: 'subscription' }), { merge: true })
    const setPaths = docSet.mock.calls.map((c) => c[0])
    expect(setPaths.indexOf('webhookEvents/evt_1')).toBe(setPaths.length - 1)
  })

  it('halted: revokes grants', async () => {
    const halted = { ...CHARGED, event: 'subscription.halted', payload: { subscription: { entity: { id: 'sub_1', status: 'halted', current_end: 1750000000 } } } }
    await POST(signed(halted, 'evt_2'))
    expect(writeEntitlement).toHaveBeenCalledWith('u1', 'crackloop', expect.objectContaining({
      entitlements: { adFree: false, unlimitedAi: false, tier: null },
    }))
  })

  it('halted: preserves lifetime grant without downgrade', async () => {
    docGet.mockImplementation(async (path: string) => {
      if (path === 'webhookEvents/evt_6') return { exists: false }
      if (path === 'razorpaySubscriptions/sub_1') return { exists: true, data: () => ({ uid: 'u1', appId: 'crackloop', planId: PLAN.id }) }
      if (path === 'users/u1/apps/crackloop') return { exists: true, data: () => ({ subscription: { status: 'lifetime' } }) }
      return { exists: false, data: () => undefined }
    })
    const halted = { ...CHARGED, event: 'subscription.halted', payload: { subscription: { entity: { id: 'sub_1', status: 'halted', current_end: 1750000000 } } } }
    const res = await POST(signed(halted, 'evt_6'))
    expect(res.status).toBe(200)
    expect(writeEntitlement).not.toHaveBeenCalled()
    const setPaths = docSet.mock.calls.map((c) => c[0])
    expect(setPaths).toContain('webhookEvents/evt_6')
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
    const body = { event: 'payment.authorized', payload: {} }
    const res = await POST(signed(body, 'evt_5'))
    expect(res.status).toBe(200)
    expect(writeEntitlement).not.toHaveBeenCalled()
    expect(docSet).toHaveBeenCalledTimes(1)
    expect(docSet.mock.calls[0][0]).toBe('webhookEvents/evt_5')
  })

  it('refund on a lifetime order revokes access and reverses the commission', async () => {
    const orderRef = { set: (d: unknown, o?: unknown) => docSet('orders/order_1', d, o) }
    orderQueryGet.mockResolvedValue({
      docs: [{ data: () => ({ uid: 'u1', appId: 'crackloop', paymentId: 'pay_r' }), ref: orderRef }],
    })
    const body = { event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_1', payment_id: 'pay_r', amount: 199900 } } } }
    const res = await POST(signed(body, 'evt_11'))
    expect(res.status).toBe(200)
    expect(clearEntitlement).toHaveBeenCalledWith('u1', 'crackloop', 'refunded')
    expect(reverseReferral).toHaveBeenCalledWith('lifetime-u1-crackloop', expect.any(Number))
    expect(docSet).toHaveBeenCalledWith('orders/order_1', expect.objectContaining({ status: 'refunded' }), { merge: true })
  })

  it('refund with no matching order warns, does not revoke', async () => {
    orderQueryGet.mockResolvedValue({ docs: [] })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const body = { event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_2', payment_id: 'pay_unknown', amount: 5000 } } } }
    const res = await POST(signed(body, 'evt_12'))
    expect(res.status).toBe(200)
    expect(clearEntitlement).not.toHaveBeenCalled()
    expect(reverseReferral).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('charged with promo on index doc records commission', async () => {
    getEnrollment.mockResolvedValue({ status: 'approved', discountPct: 10, commissionRates: { signupPaise: 0, perPlan: { 'crackloop-pro-1m': 1500 } } })
    docGet.mockImplementation(async (path: string) => {
      if (path === 'webhookEvents/evt_7') return { exists: false }
      if (path === 'razorpaySubscriptions/sub_1')
        return { exists: true, data: () => ({ uid: 'u1', appId: 'crackloop', planId: 'crackloop-pro-1m', promoCode: 'AK10X', promoOwnerUid: 'inf1' }) }
      return { exists: false, data: () => undefined }
    })
    await POST(signed(CHARGED, 'evt_7'))
    expect(recordReferral).toHaveBeenCalledWith(expect.objectContaining({
      id: 'sub-sub_1', type: 'subscription', ownerUid: 'inf1', appId: 'crackloop', referredUid: 'u1', commissionPaise: 1500,
    }))
  })

  it('zero-rate plan records nothing; unapproved owner skips with warn', async () => {
    docGet.mockImplementation(async (path: string) => {
      if (path === 'webhookEvents/evt_8') return { exists: false }
      if (path === 'razorpaySubscriptions/sub_1')
        return { exists: true, data: () => ({ uid: 'u1', appId: 'crackloop', planId: 'crackloop-pro-1m', promoCode: 'AK10X', promoOwnerUid: 'inf1' }) }
      return { exists: false, data: () => undefined }
    })
    getEnrollment.mockResolvedValue({ status: 'approved', discountPct: 10, commissionRates: { signupPaise: 0, perPlan: {} } })
    await POST(signed(CHARGED, 'evt_8'))
    expect(recordReferral).not.toHaveBeenCalled()

    docGet.mockImplementation(async (path: string) => {
      if (path === 'webhookEvents/evt_9') return { exists: false }
      if (path === 'razorpaySubscriptions/sub_1')
        return { exists: true, data: () => ({ uid: 'u1', appId: 'crackloop', planId: 'crackloop-pro-1m', promoCode: 'AK10X', promoOwnerUid: 'inf1' }) }
      return { exists: false, data: () => undefined }
    })
    getEnrollment.mockResolvedValue({ status: 'rejected', discountPct: 10, commissionRates: { signupPaise: 0, perPlan: { 'crackloop-pro-1m': 1500 } } })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await POST(signed(CHARGED, 'evt_9'))
    expect(recordReferral).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('order.paid backup path records lifetime commission from order doc', async () => {
    getPlanById.mockResolvedValue({ ...PLAN, id: 'life', lifetime: true, durationMonths: null, razorpayPlanId: null })
    getEnrollment.mockResolvedValue({ status: 'approved', discountPct: 10, commissionRates: { signupPaise: 0, perPlan: { life: 20000 } } })
    docGet.mockImplementation(async (path: string) => {
      if (path === 'webhookEvents/evt_10') return { exists: false }
      if (path === 'orders/order_2')
        return { exists: true, data: () => ({ uid: 'u1', appId: 'crackloop', planId: 'life', amountPaise: 179910, status: 'created', promoCode: 'AK10X', promoOwnerUid: 'inf1' }) }
      return { exists: false }
    })
    const body = { event: 'order.paid', payload: { order: { entity: { id: 'order_2' } }, payment: { entity: { id: 'pay_10', amount: 179910 } } } }
    await POST(signed(body, 'evt_10'))
    expect(recordReferral).toHaveBeenCalledWith(expect.objectContaining({
      id: 'lifetime-u1-crackloop', type: 'lifetime', ownerUid: 'inf1', appId: 'crackloop', referredUid: 'u1', commissionPaise: 20000,
    }))
  })
})
