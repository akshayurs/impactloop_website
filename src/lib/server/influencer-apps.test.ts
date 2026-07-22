import { beforeEach, describe, expect, it, vi } from 'vitest'

const { docGet, docSet, docDelete, listGet, aggGet } = vi.hoisted(() => ({
  docGet: vi.fn(), docSet: vi.fn(), docDelete: vi.fn(), listGet: vi.fn(), aggGet: vi.fn(),
}))
vi.mock('firebase-admin/firestore', () => ({ AggregateField: { sum: (f: string) => ({ sum: f }) } }))
vi.mock('./firebase-admin', () => {
  const makeQuery = () => {
    const q: Record<string, unknown> = {}
    Object.assign(q, {
      where: () => q,
      orderBy: () => q,
      limit: () => q,
      startAfter: () => q,
      aggregate: () => ({ get: () => aggGet() }),
      get: () => listGet(),
    })
    return q
  }
  return {
    adminDb: () => ({
      doc: (path: string) => ({
        get: () => docGet(path),
        set: (d: unknown, o?: unknown) => docSet(path, d, o),
        delete: () => docDelete(path),
      }),
      collection: () => makeQuery(),
      runTransaction: (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          get: (ref: { get: () => unknown }) => ref.get(),
          set: (ref: { set: (d: unknown, o?: unknown) => unknown }, d: unknown, o?: unknown) => ref.set(d, o),
          delete: (ref: { delete: () => unknown }) => ref.delete(),
        }),
    }),
  }
})

import {
  changeAppPromoCode,
  decideEnrollment,
  enroll,
  hasApprovedEnrollment,
  listAppEnrollments,
  updateAppCommission,
} from './influencer-apps'

beforeEach(() => {
  vi.clearAllMocks()
  docGet.mockResolvedValue({ exists: false, data: () => undefined })
  listGet.mockResolvedValue({ empty: true, docs: [] })
  aggGet.mockResolvedValue({ data: () => ({ total: 0 }) })
})

describe('enroll', () => {
  it('requires the shared identity first', async () => {
    docGet.mockImplementation(async (path: string) => ({ exists: path !== 'influencers/u1', data: () => ({}) }))
    await expect(enroll('u1', 'crackloop', 5)).rejects.toThrow(/program first/)
  })
  it('creates a pending enrollment when identity exists and none yet', async () => {
    docGet.mockImplementation(async (path: string) =>
      path === 'influencers/u1' ? { exists: true, data: () => ({}) } : { exists: false, data: () => undefined },
    )
    await enroll('u1', 'crackloop', 5)
    expect(docSet).toHaveBeenCalledWith(
      'influencerApps/u1_crackloop',
      expect.objectContaining({ uid: 'u1', appId: 'crackloop', status: 'pending', appliedAt: 5 }),
      undefined,
    )
  })
  it('rejects double-enrollment while pending/approved', async () => {
    docGet.mockImplementation(async (path: string) =>
      path === 'influencers/u1'
        ? { exists: true, data: () => ({}) }
        : { exists: true, data: () => ({ status: 'approved' }) },
    )
    await expect(enroll('u1', 'crackloop', 5)).rejects.toThrow(/already enrolled/)
  })
})

describe('decideEnrollment', () => {
  it('approves only from pending', async () => {
    docGet.mockResolvedValue({ exists: true, data: () => ({ status: 'pending' }) })
    await decideEnrollment('u1', 'crackloop', 'approved', 7)
    expect(docSet).toHaveBeenCalledWith('influencerApps/u1_crackloop', { status: 'approved', decidedAt: 7 }, { merge: true })
    docGet.mockResolvedValue({ exists: true, data: () => ({ status: 'approved' }) })
    await expect(decideEnrollment('u1', 'crackloop', 'approved', 8)).rejects.toThrow(/pending/)
  })
})

describe('updateAppCommission', () => {
  it('validates and writes commission fields', async () => {
    docGet.mockResolvedValue({ exists: true, data: () => ({ status: 'approved' }) })
    await updateAppCommission('u1', 'crackloop', { signupPaise: 500, perPlan: { p1: 1000 } })
    expect(docSet).toHaveBeenCalledWith(
      'influencerApps/u1_crackloop',
      { 'commissionRates.signupPaise': 500, 'commissionRates.perPlan': { p1: 1000 } },
      { merge: true },
    )
    await expect(updateAppCommission('u1', 'crackloop', { signupPaise: -5 })).rejects.toThrow(/signupPaise/)
    await expect(updateAppCommission('u1', 'crackloop', { perPlan: { p1: 10.5 } })).rejects.toThrow(/perPlan/)
  })
})

describe('changeAppPromoCode', () => {
  it('approved enrollment claims available code, old deleted, stored with appId', async () => {
    docGet.mockImplementation(async (path: string) => {
      if (path === 'influencerApps/u1_crackloop') return { exists: true, data: () => ({ status: 'approved', promoCode: 'OLD1' }) }
      return { exists: false }
    })
    const res = await changeAppPromoCode('u1', 'crackloop', ' new42 ', 1000, 3)
    expect(res.code).toBe('NEW42')
    expect(docDelete).toHaveBeenCalledWith('promoCodes/OLD1')
    expect(docSet).toHaveBeenCalledWith(
      'promoCodes/NEW42',
      { code: 'NEW42', ownerUid: 'u1', appId: 'crackloop', active: true, createdAt: 1000, expiresAt: 1000 + 3 * 30 * 86_400_000 },
      undefined,
    )
    expect(docSet).toHaveBeenCalledWith('influencerApps/u1_crackloop', { promoCode: 'NEW42' }, { merge: true })
  })
  it('rejects taken code, bad shape, non-approved', async () => {
    docGet.mockImplementation(async (path: string) => {
      if (path === 'influencerApps/u1_crackloop') return { exists: true, data: () => ({ status: 'approved', promoCode: null }) }
      return { exists: true, data: () => ({ ownerUid: 'other' }) }
    })
    await expect(changeAppPromoCode('u1', 'crackloop', 'TAKEN1', 1, 3)).rejects.toThrow(/taken/)
    await expect(changeAppPromoCode('u1', 'crackloop', 'x', 1, 3)).rejects.toThrow(/code/)
    docGet.mockImplementation(async (path: string) =>
      path === 'influencerApps/u1_crackloop' ? { exists: true, data: () => ({ status: 'pending' }) } : { exists: false },
    )
    await expect(changeAppPromoCode('u1', 'crackloop', 'GOOD42', 1, 3)).rejects.toThrow(/approved/)
  })
})

describe('hasApprovedEnrollment / listAppEnrollments', () => {
  it('hasApprovedEnrollment reflects query emptiness', async () => {
    listGet.mockResolvedValue({ empty: true, docs: [] })
    expect(await hasApprovedEnrollment('u1')).toBe(false)
    listGet.mockResolvedValue({ empty: false, docs: [{ id: 'u1_crackloop' }] })
    expect(await hasApprovedEnrollment('u1')).toBe(true)
  })
  it('listAppEnrollments maps docs', async () => {
    listGet.mockResolvedValue({
      empty: false,
      docs: [{ id: 'u1_crackloop', data: () => ({ uid: 'u1', appId: 'crackloop', status: 'approved', appliedAt: 5 }) }],
    })
    const { enrollments } = await listAppEnrollments('crackloop', {})
    expect(enrollments).toHaveLength(1)
    expect(enrollments[0]).toMatchObject({ uid: 'u1', status: 'approved' })
  })
})
