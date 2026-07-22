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
          delete: () => {},
        }),
    }),
  }
})

import { applyAsInfluencer, getEarnings, recordPayout, recordReferral, reverseReferral, suggestCodes } from './influencer'

beforeEach(() => {
  vi.clearAllMocks()
  docGet.mockResolvedValue({ exists: false, data: () => undefined })
  listGet.mockResolvedValue({ docs: [] })
  aggGet.mockResolvedValue({ data: () => ({ total: 0 }) })
})

describe('applyAsInfluencer', () => {
  it('writes shared identity with social links, merging', async () => {
    await applyAsInfluencer('u1', ['https://instagram.com/x'], 5)
    expect(docSet).toHaveBeenCalledWith(
      'influencers/u1',
      expect.objectContaining({ socialLinks: ['https://instagram.com/x'], appliedAt: 5 }),
      { merge: true },
    )
  })
  it('preserves the original appliedAt on re-apply', async () => {
    docGet.mockResolvedValue({ exists: true, data: () => ({ appliedAt: 100, socialLinks: [] }) })
    await applyAsInfluencer('u1', ['https://x.com/a'], 999)
    expect(docSet).toHaveBeenCalledWith('influencers/u1', expect.objectContaining({ appliedAt: 100 }), { merge: true })
  })
  it('rejects invalid links', async () => {
    await expect(applyAsInfluencer('u1', [], 5)).rejects.toThrow(/link/)
    await expect(applyAsInfluencer('u1', ['notaurl'], 5)).rejects.toThrow(/link/)
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
  it('recordReferral is atomic create-if-absent', async () => {
    docCreate.mockResolvedValueOnce(undefined)
    const first = await recordReferral({ id: 'pay-p1', code: 'C', ownerUid: 'u1', appId: 'crackloop', referredUid: 'u2', type: 'subscription', planId: 'p', commissionPaise: 100, nowMillis: 1 })
    expect(first).toBe(true)
    expect(docCreate).toHaveBeenCalledWith('referrals/pay-p1', expect.objectContaining({ commissionPaise: 100, appId: 'crackloop' }))
    docCreate.mockRejectedValueOnce(Object.assign(new Error('exists'), { code: 6 }))
    const second = await recordReferral({ id: 'pay-p1', code: 'C', ownerUid: 'u1', appId: 'crackloop', referredUid: 'u2', type: 'subscription', planId: 'p', commissionPaise: 100, nowMillis: 1 })
    expect(second).toBe(false)
  })
  it('reverseReferral zeroes commission once (idempotent)', async () => {
    docGet.mockResolvedValueOnce({ exists: true, data: () => ({ commissionPaise: 2000 }) })
    expect(await reverseReferral('lifetime-u2-crackloop', 5)).toBe(true)
    expect(docSet).toHaveBeenCalledWith(
      'referrals/lifetime-u2-crackloop',
      expect.objectContaining({ reversed: true, commissionPaise: 0, originalCommissionPaise: 2000 }),
      { merge: true },
    )
    docGet.mockResolvedValueOnce({ exists: true, data: () => ({ reversed: true }) })
    expect(await reverseReferral('lifetime-u2-crackloop', 6)).toBe(false)
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
    expect(txSet).toHaveBeenCalledWith({
      influencerUid: 'u1',
      amountPaise: 200,
      note: 'upi',
      paidAt: 7,
      balanceBeforePaise: 200,
      commissionTotalPaise: 300,
    })
  })
})
