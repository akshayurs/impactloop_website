import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  requireAdmin,
  decideEnrollment,
  updateAppCommission,
  changeAppPromoCode,
  getEnrollment,
  listAppEnrollments,
  getPartnerConfig,
  recordPayout,
  requestPayout,
  declinePayoutRequest,
  normalizeUpiId,
  getEarnings,
  adminAuth,
  docGet,
} = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  decideEnrollment: vi.fn(),
  updateAppCommission: vi.fn(),
  changeAppPromoCode: vi.fn(),
  getEnrollment: vi.fn(),
  listAppEnrollments: vi.fn(),
  getPartnerConfig: vi.fn(),
  recordPayout: vi.fn(),
  requestPayout: vi.fn(),
  declinePayoutRequest: vi.fn(),
  normalizeUpiId: vi.fn((v: string) => v),
  getEarnings: vi.fn(),
  adminAuth: vi.fn(),
  docGet: vi.fn(),
}))

vi.mock('@/lib/server/require-admin', () => ({
  requireAdmin,
  ForbiddenError: class extends Error { status = 403 },
}))
vi.mock('@/lib/server/verify-token', () => ({ UnauthorizedError: class extends Error { status = 401 } }))
vi.mock('@/lib/server/influencer', () => ({ recordPayout, requestPayout, declinePayoutRequest, normalizeUpiId, getEarnings }))
vi.mock('@/lib/server/influencer-apps', () => ({
  decideEnrollment,
  updateAppCommission,
  changeAppPromoCode,
  getEnrollment,
  listAppEnrollments,
}))
vi.mock('@/lib/server/partner-config', () => ({ getPartnerConfig }))
vi.mock('@/lib/server/email/notify', () => ({
  notifyInfluencerDecision: vi.fn().mockResolvedValue(undefined),
  notifyPayoutRequest: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/server/settings', () => ({
  getSettings: vi.fn().mockResolvedValue({ freeTrialEnabled: true, trialDays: 7, promoDefaultExpiryMonths: 3 }),
}))
vi.mock('@/lib/server/firebase-admin', () => ({
  adminAuth: () => adminAuth(),
  adminDb: () => ({ doc: (path: string) => ({ get: () => docGet(path) }) }),
}))

import { GET as influencersGET } from './route'
import { POST as influencersPOST } from './[uid]/route'

const authed = { headers: { Authorization: 'Bearer t' } }

beforeEach(() => {
  vi.clearAllMocks()
  getPartnerConfig.mockResolvedValue({ discountPct: 10, enabled: true })
  docGet.mockResolvedValue({ exists: false, data: () => undefined })
})

describe('admin influencers guard', () => {
  it('401 when unauthenticated', async () => {
    const { UnauthorizedError } = await import('@/lib/server/verify-token')
    requireAdmin.mockRejectedValue(new UnauthorizedError('no'))
    expect((await influencersGET(new Request('http://x'))).status).toBe(401)
  })

  it('403 when not admin', async () => {
    const { ForbiddenError } = await import('@/lib/server/require-admin')
    requireAdmin.mockRejectedValue(new ForbiddenError('no'))
    expect((await influencersGET(new Request('http://x', authed))).status).toBe(403)
  })
})

describe('GET /api/admin/influencers', () => {
  beforeEach(() => {
    requireAdmin.mockResolvedValue({ uid: 'admin', email: 'a@b.c' })
  })

  it('lists app enrollments joined with email + app-default discount', async () => {
    adminAuth.mockReturnValue({
      getUser: vi.fn(async (uid: string) => {
        if (uid === 'inf1') return { email: 'influencer@x.com' }
        throw new Error('not found')
      }),
    })
    docGet.mockResolvedValue({ exists: true, data: () => ({ socialLinks: ['https://instagram.com/x'] }) })
    listAppEnrollments.mockResolvedValue({
      enrollments: [
        { uid: 'inf1', appId: 'crackloop', status: 'approved', appliedAt: 100, promoCode: 'AK10', commissionRates: { signupPaise: 500, perPlan: { p1: 1000 } } },
      ],
      nextCursor: null,
    })
    const res = await influencersGET(new Request('http://x', authed))
    const json = await res.json()
    expect(json.influencers).toHaveLength(1)
    expect(json.influencers[0]).toMatchObject({
      uid: 'inf1',
      email: 'influencer@x.com',
      status: 'approved',
      discountPct: 10,
    })
  })
})

describe('POST /api/admin/influencers/[uid]', () => {
  beforeEach(() => {
    requireAdmin.mockResolvedValue({ uid: 'admin', email: 'a@b.c' })
  })

  it('approve calls decideEnrollment for the default app', async () => {
    const res = await influencersPOST(new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'approve' }) }), {
      params: Promise.resolve({ uid: 'inf1' }),
    })
    expect(res.status).toBe(200)
    expect(decideEnrollment).toHaveBeenCalledWith('inf1', 'crackloop', 'approved', expect.any(Number))
  })

  it('reject calls decideEnrollment', async () => {
    const res = await influencersPOST(new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'reject' }) }), {
      params: Promise.resolve({ uid: 'inf1' }),
    })
    expect(res.status).toBe(200)
    expect(decideEnrollment).toHaveBeenCalledWith('inf1', 'crackloop', 'rejected', expect.any(Number))
  })

  it('honors an explicit appId', async () => {
    await influencersPOST(new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'approve', appId: 'loopquiz' }) }), {
      params: Promise.resolve({ uid: 'inf1' }),
    })
    expect(decideEnrollment).toHaveBeenCalledWith('inf1', 'loopquiz', 'approved', expect.any(Number))
  })

  it('approve returns 400 on store error', async () => {
    decideEnrollment.mockRejectedValue(new Error('only pending enrollments'))
    const res = await influencersPOST(new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'approve' }) }), {
      params: Promise.resolve({ uid: 'inf1' }),
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/pending/)
  })

  it('update-rates forwards commission fields', async () => {
    const res = await influencersPOST(
      new Request('http://x', {
        ...authed,
        method: 'POST',
        body: JSON.stringify({ action: 'update-rates', signupPaise: 500, perPlan: { p1: 1000 } }),
      }),
      { params: Promise.resolve({ uid: 'inf1' }) },
    )
    expect(res.status).toBe(200)
    expect(updateAppCommission).toHaveBeenCalledWith('inf1', 'crackloop', { signupPaise: 500, perPlan: { p1: 1000 } })
  })

  it('update-rates returns 400 on validation error', async () => {
    updateAppCommission.mockRejectedValue(new Error('signupPaise must be non-negative integer'))
    const res = await influencersPOST(
      new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'update-rates', signupPaise: -5 }) }),
      { params: Promise.resolve({ uid: 'inf1' }) },
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/signupPaise/)
  })

  it('mark-paid respects balance error', async () => {
    recordPayout.mockRejectedValue(new Error('amount exceeds balance (300)'))
    const res = await influencersPOST(
      new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'mark-paid', amountPaise: 500, note: 'upi' }) }),
      { params: Promise.resolve({ uid: 'inf1' }) },
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/balance/)
  })

  it('mark-paid calls recordPayout', async () => {
    recordPayout.mockResolvedValue(undefined)
    const res = await influencersPOST(
      new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'mark-paid', amountPaise: 200, note: 'upi' }) }),
      { params: Promise.resolve({ uid: 'inf1' }) },
    )
    expect(res.status).toBe(200)
    expect(recordPayout).toHaveBeenCalledWith('inf1', 200, 'upi', expect.any(Number))
  })

  it('decline-payout declines a pending request', async () => {
    declinePayoutRequest.mockResolvedValue(undefined)
    const res = await influencersPOST(
      new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'decline-payout' }) }),
      { params: Promise.resolve({ uid: 'inf1' }) },
    )
    expect(res.status).toBe(200)
    expect(declinePayoutRequest).toHaveBeenCalledWith('inf1', expect.any(Number))
  })

  it('request-payout requires an approved enrollment then creates the request', async () => {
    getEnrollment.mockResolvedValue({ status: 'approved' })
    requestPayout.mockResolvedValue({ amountPaise: 400, requestedAt: 1, upiId: 'ak@ybl' })
    const res = await influencersPOST(
      new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'request-payout', upiId: 'ak@ybl' }) }),
      { params: Promise.resolve({ uid: 'inf1' }) },
    )
    expect(res.status).toBe(200)
    expect(normalizeUpiId).toHaveBeenCalledWith('ak@ybl')
    expect(requestPayout).toHaveBeenCalledWith('inf1', 0, 'ak@ybl', expect.any(Number))
  })

  it('request-payout 400 when enrollment not approved', async () => {
    getEnrollment.mockResolvedValue({ status: 'pending' })
    const res = await influencersPOST(
      new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'request-payout', upiId: 'ak@ybl' }) }),
      { params: Promise.resolve({ uid: 'inf1' }) },
    )
    expect(res.status).toBe(400)
    expect(requestPayout).not.toHaveBeenCalled()
  })

  it('request-payout returns 400 on invalid UPI', async () => {
    normalizeUpiId.mockImplementationOnce(() => {
      throw new Error('enter a valid UPI ID (e.g. name@bank)')
    })
    const res = await influencersPOST(
      new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'request-payout', upiId: 'bad' }) }),
      { params: Promise.resolve({ uid: 'inf1' }) },
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/UPI/)
    expect(requestPayout).not.toHaveBeenCalled()
  })

  it('earnings action returns summary', async () => {
    getEarnings.mockResolvedValue({ totalCommissionPaise: 500, paidPaise: 100, balancePaise: 400, referrals: [], payouts: [] })
    const res = await influencersPOST(new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'earnings' }) }), {
      params: Promise.resolve({ uid: 'inf1' }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).balancePaise).toBe(400)
  })

  it('set-code calls changeAppPromoCode; unknown action 400', async () => {
    changeAppPromoCode.mockResolvedValue({ code: 'NEWCODE10', expiresAt: 123 })
    const okRes = await influencersPOST(
      new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'set-code', code: 'newcode10' }) }),
      { params: Promise.resolve({ uid: 'inf1' }) },
    )
    expect(okRes.status).toBe(200)
    expect(changeAppPromoCode).toHaveBeenCalledWith('inf1', 'crackloop', 'newcode10', expect.any(Number), 3)

    const res = await influencersPOST(new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'nuke' }) }), {
      params: Promise.resolve({ uid: 'inf1' }),
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/unknown/)
  })
})
