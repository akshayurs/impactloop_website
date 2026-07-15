import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireUser, verifyPaymentSignature, getPlanById, writeEntitlement, orderGet, docSet, getInfluencer, recordReferral } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  verifyPaymentSignature: vi.fn(),
  getPlanById: vi.fn(),
  writeEntitlement: vi.fn(),
  orderGet: vi.fn(),
  docSet: vi.fn(),
  getInfluencer: vi.fn(),
  recordReferral: vi.fn(),
}))

vi.mock('@/lib/server/verify-token', () => ({ requireUser, UnauthorizedError: class extends Error { status = 401 } }))
vi.mock('@/lib/server/razorpay', () => ({ verifyPaymentSignature }))
vi.mock('@/lib/server/plans-store', () => ({ getPlanById }))
vi.mock('@/lib/server/influencer', () => ({ getInfluencer, recordReferral }))
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
    getInfluencer.mockResolvedValue(null)
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

  it('order with promo records lifetime commission', async () => {
    orderGet.mockResolvedValue({
      exists: true,
      data: () => ({ uid: 'u1', appId: 'crackloop', planId: 'life', amountPaise: 179910, status: 'created', promoCode: 'AK10X', promoOwnerUid: 'inf1' }),
    })
    getInfluencer.mockResolvedValue({ status: 'approved', discountPct: 10, commissionRates: { signupPaise: 0, perPlan: { life: 20000 } } })
    const res = await POST(req(GOOD))
    expect(res.status).toBe(200)
    expect(recordReferral).toHaveBeenCalledWith(expect.objectContaining({
      id: 'pay-pay_1', type: 'lifetime', ownerUid: 'inf1', referredUid: 'u1', commissionPaise: 20000,
    }))
  })
})
