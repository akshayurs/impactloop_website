import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  requireAdmin,
  decideInfluencer,
  updateInfluencerRates,
  recordPayout,
  getEarnings,
  changePromoCode,
  adminAuth,
  docGet,
  docsGet,
} = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  decideInfluencer: vi.fn(),
  updateInfluencerRates: vi.fn(),
  recordPayout: vi.fn(),
  getEarnings: vi.fn(),
  changePromoCode: vi.fn(),
  adminAuth: vi.fn(),
  docGet: vi.fn(),
  docsGet: vi.fn(),
}))

vi.mock('@/lib/server/require-admin', () => ({
  requireAdmin,
  ForbiddenError: class extends Error { status = 403 },
}))
vi.mock('@/lib/server/verify-token', () => ({ UnauthorizedError: class extends Error { status = 401 } }))
vi.mock('@/lib/server/influencer', () => ({
  decideInfluencer,
  updateInfluencerRates,
  recordPayout,
  getEarnings,
  changePromoCode,
}))
vi.mock('@/lib/server/settings', () => ({
  getSettings: vi.fn().mockResolvedValue({ freeTrialEnabled: true, trialDays: 7, promoDefaultExpiryMonths: 3 }),
}))
vi.mock('@/lib/server/firebase-admin', () => ({
  adminAuth: () => adminAuth(),
  adminDb: () => ({
    collection: () => ({
      orderBy: () => ({
        limit: () => ({
          get: () => docsGet(),
          startAfter: () => ({ get: () => docsGet() }),
        }),
      }),
    }),
  }),
}))

import { GET as influencersGET } from './route'
import { POST as influencersPOST } from './[uid]/route'

const authed = { headers: { Authorization: 'Bearer t' } }

describe('admin influencers guard', () => {
  beforeEach(() => vi.clearAllMocks())

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
    vi.clearAllMocks()
    requireAdmin.mockResolvedValue({ uid: 'admin', email: 'a@b.c' })
  })

  it('list joins emails', async () => {
    adminAuth.mockReturnValue({
      getUser: vi.fn(async (uid: string) => {
        if (uid === 'inf1') return { email: 'influencer@x.com' }
        throw new Error('not found')
      }),
    })
    docsGet.mockResolvedValue({
      docs: [
        {
          id: 'inf1',
          data: () => ({
            status: 'approved',
            socialLinks: ['https://instagram.com/x'],
            appliedAt: 100,
            promoCode: 'AK10',
            discountPct: 10,
            commissionRates: { signupPaise: 500, perPlan: { 'p1': 1000 } },
          }),
        },
      ],
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
    vi.clearAllMocks()
    requireAdmin.mockResolvedValue({ uid: 'admin', email: 'a@b.c' })
  })

  it('approve calls decideInfluencer', async () => {
    const res = await influencersPOST(new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'approve' }) }), {
      params: Promise.resolve({ uid: 'inf1' }),
    })
    expect(res.status).toBe(200)
    expect(decideInfluencer).toHaveBeenCalledWith('inf1', 'approve', expect.any(Number))
  })

  it('reject calls decideInfluencer', async () => {
    const res = await influencersPOST(new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'reject' }) }), {
      params: Promise.resolve({ uid: 'inf1' }),
    })
    expect(res.status).toBe(200)
    expect(decideInfluencer).toHaveBeenCalledWith('inf1', 'reject', expect.any(Number))
  })

  it('approve returns 400 on store error', async () => {
    decideInfluencer.mockRejectedValue(new Error('only pending applications'))
    const res = await influencersPOST(new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'approve' }) }), {
      params: Promise.resolve({ uid: 'inf1' }),
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/pending/)
  })

  it('update-rates forwards fields', async () => {
    const res = await influencersPOST(
      new Request('http://x', {
        ...authed,
        method: 'POST',
        body: JSON.stringify({ action: 'update-rates', discountPct: 15, signupPaise: 500, perPlan: { p1: 1000 } }),
      }),
      { params: Promise.resolve({ uid: 'inf1' }) },
    )
    expect(res.status).toBe(200)
    expect(updateInfluencerRates).toHaveBeenCalledWith('inf1', { discountPct: 15, signupPaise: 500, perPlan: { p1: 1000 } })
  })

  it('update-rates returns 400 on validation error', async () => {
    updateInfluencerRates.mockRejectedValue(new Error('discountPct must be 0-90'))
    const res = await influencersPOST(
      new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'update-rates', discountPct: 95 }) }),
      { params: Promise.resolve({ uid: 'inf1' }) },
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/0-90/)
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

  it('earnings action returns summary', async () => {
    getEarnings.mockResolvedValue({ totalCommissionPaise: 500, paidPaise: 100, balancePaise: 400, referrals: [], payouts: [] })
    const res = await influencersPOST(new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'earnings' }) }), {
      params: Promise.resolve({ uid: 'inf1' }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.balancePaise).toBe(400)
  })

  it('unknown action returns 400', async () => {
    changePromoCode.mockResolvedValue({ code: 'NEWCODE10', expiresAt: 123 })
    const okRes = await influencersPOST(
      new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'set-code', code: 'newcode10' }) }),
      { params: Promise.resolve({ uid: 'inf1' }) },
    )
    expect(okRes.status).toBe(200)
    expect(changePromoCode).toHaveBeenCalledWith('inf1', 'newcode10', expect.any(Number), 3)

    const res = await influencersPOST(new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'nuke' }) }), {
      params: Promise.resolve({ uid: 'inf1' }),
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/unknown/)
  })
})
