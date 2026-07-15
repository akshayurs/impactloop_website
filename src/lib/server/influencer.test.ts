import { beforeEach, describe, expect, it, vi } from 'vitest'

const { docGet, docSet, docDelete, docCreate, listGet, aggGet, txSet } = vi.hoisted(() => ({
  docGet: vi.fn(), docSet: vi.fn(), docDelete: vi.fn(), docCreate: vi.fn(),
  listGet: vi.fn(), aggGet: vi.fn(), txSet: vi.fn(),
}))
vi.mock('firebase-admin/firestore', () => ({ AggregateField: { sum: (f: string) => ({ sum: f }) } }))
vi.mock('./firebase-admin', () => {
  const makeQuery = (name: string) => {
    const q: Record<string, unknown> = {}
    Object.assign(q, {
      where: () => q,
      orderBy: () => q,
      limit: () => q,
      aggregate: () => ({ get: () => aggGet(name), __agg: name }),
      get: () => listGet(name),
    })
    return q
  }
  return {
    adminDb: () => ({
      doc: (path: string) => ({
        get: () => docGet(path),
        set: (d: unknown, o?: unknown) => docSet(path, d, o),
        delete: () => docDelete(path),
        create: (d: unknown) => docCreate(path, d),
      }),
      collection: (name: string) => makeQuery(name),
      runTransaction: (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          get: (query: { __agg: string }) => aggGet(query.__agg),
          set: (_ref: unknown, data: unknown) => txSet(data),
        }),
    }),
  }
})

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
  listGet.mockResolvedValue({ docs: [] })
  aggGet.mockResolvedValue({ data: () => ({ total: 0 }) })
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
  it('earnings totals come from full-collection aggregation, not capped lists', async () => {
    aggGet.mockImplementation((name: string) => Promise.resolve({ data: () => ({ total: name === 'referrals' ? 500 : 100 }) }))
    listGet.mockImplementation((name: string) =>
      Promise.resolve({
        docs:
          name === 'referrals'
            ? [{ id: 'r1', data: () => ({ commissionPaise: 300 }) }, { id: 'r2', data: () => ({ commissionPaise: 200 }) }]
            : [{ id: 'po1', data: () => ({ amountPaise: 100 }) }],
      }),
    )
    const e = await getEarnings('u1')
    expect(e.totalCommissionPaise).toBe(500)
    expect(e.paidPaise).toBe(100)
    expect(e.balancePaise).toBe(400)
    expect(e.referrals).toHaveLength(2)
    expect(e.payouts).toHaveLength(1)
  })
  it('payout cannot exceed balance', async () => {
    aggGet.mockImplementation((name: string) => Promise.resolve({ data: () => ({ total: name === 'referrals' ? 300 : 0 }) }))
    await expect(recordPayout('u1', 500, 'upi', 1)).rejects.toThrow(/balance/)
    expect(txSet).not.toHaveBeenCalled()
  })
  it('payout within balance writes payout in a transaction', async () => {
    aggGet.mockImplementation((name: string) => Promise.resolve({ data: () => ({ total: name === 'referrals' ? 300 : 100 }) }))
    await recordPayout('u1', 200, 'upi', 7)
    expect(txSet).toHaveBeenCalledWith({ influencerUid: 'u1', amountPaise: 200, note: 'upi', paidAt: 7 })
  })
})
