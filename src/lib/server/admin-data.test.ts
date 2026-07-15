import { beforeEach, describe, expect, it, vi } from 'vitest'

const { docGet, docSet, collGet, listUsersFn, getUserFn, createPlan } = vi.hoisted(() => ({
  docGet: vi.fn(),
  docSet: vi.fn(),
  collGet: vi.fn(),
  listUsersFn: vi.fn(),
  getUserFn: vi.fn(),
  createPlan: vi.fn(),
}))
vi.mock('./firebase-admin', () => {
  const query = (path: string): Record<string, unknown> => ({
    orderBy: () => query(path),
    limit: () => query(path),
    startAfter: () => query(path),
    where: () => query(path),
    get: () => collGet(path),
  })
  return {
    adminDb: () => ({
      doc: (path: string) => ({ get: () => docGet(path), set: (d: unknown, o?: unknown) => docSet(path, d, o) }),
      collection: (path: string) => query(path),
      collectionGroup: (path: string) => ({ get: () => collGet(path) }),
    }),
    adminAuth: () => ({ listUsers: listUsersFn, getUser: getUserFn }),
  }
})
vi.mock('./razorpay', () => ({ createPlan }))

import {
  createPlanWithRazorpay,
  getMetrics,
  getUserDetail,
  listUsers,
  listWebhookEvents,
  revokeEntitlement,
  updatePlanFields,
} from './admin-data'

describe('listUsers', () => {
  beforeEach(() => vi.clearAllMocks())
  it('maps and filters users case-insensitively', async () => {
    listUsersFn.mockResolvedValue({
      users: [
        { uid: 'u1', email: 'Alice@x.com', displayName: 'Alice', customClaims: { admin: true }, metadata: { creationTime: 't1' } },
        { uid: 'u2', email: 'bob@x.com', displayName: null, customClaims: undefined, metadata: { creationTime: 't2' } },
      ],
    })
    const all = await listUsers()
    expect(all.users).toHaveLength(2)
    expect(all.users[0]).toEqual({ uid: 'u1', email: 'Alice@x.com', displayName: 'Alice', admin: true, createdAt: 't1' })
    expect(all.nextCursor).toBeNull()
    expect((await listUsers('ALICE')).users).toHaveLength(1)
    expect((await listUsers('nobody')).users).toHaveLength(0)
  })

  it('passes cursor through and returns next page token', async () => {
    listUsersFn.mockResolvedValue({ users: [], pageToken: 'tok2' })
    const page = await listUsers(undefined, 'tok1')
    expect(listUsersFn).toHaveBeenCalledWith(50, 'tok1')
    expect(page.nextCursor).toBe('tok2')
  })
})

describe('getMetrics', () => {
  beforeEach(() => vi.clearAllMocks())
  it('aggregates revenue, payment count, user count, active subs, webhook events', async () => {
    collGet.mockImplementation((path: string) => {
      if (path === 'payments') {
        const docs = [{ data: () => ({ amountPaise: 1000 }) }, { data: () => ({ amountPaise: 2500 }) }]
        return Promise.resolve({ size: docs.length, forEach: (fn: (d: unknown) => void) => docs.forEach(fn) })
      }
      if (path === 'razorpaySubscriptions') return Promise.resolve({ size: 4 })
      if (path === 'webhookEvents') return Promise.resolve({ size: 7 })
      return Promise.resolve({ size: 0, forEach: () => {} })
    })
    listUsersFn.mockResolvedValue({ users: [{}, {}, {}] })
    const metrics = await getMetrics()
    expect(metrics).toEqual({
      totalRevenuePaise: 3500,
      paymentCount: 2,
      userCount: 3,
      activeSubscriptionCount: 4,
      webhookEventCount: 7,
    })
  })
})

describe('getUserDetail', () => {
  beforeEach(() => vi.clearAllMocks())
  it('returns profile, apps, payments', async () => {
    getUserFn.mockResolvedValue({ uid: 'u1', email: 'a@x.com', displayName: 'A' })
    collGet.mockImplementation((path: string) => {
      if (path === 'users/u1/apps') {
        return Promise.resolve({ docs: [{ id: 'crackloop', data: () => ({ tier: 'pro' }) }] })
      }
      if (path === 'users/u1/payments') {
        return Promise.resolve({ docs: [{ id: 'pay_1', data: () => ({ amountPaise: 100 }) }] })
      }
      return Promise.resolve({ docs: [] })
    })
    const detail = await getUserDetail('u1')
    expect(detail.profile).toEqual({ uid: 'u1', email: 'a@x.com', displayName: 'A' })
    expect(detail.apps).toEqual([{ appId: 'crackloop', data: { tier: 'pro' } }])
    expect(detail.payments).toEqual([{ id: 'pay_1', amountPaise: 100 }])
  })

  it('returns null profile when auth record missing', async () => {
    getUserFn.mockRejectedValue(new Error('no user'))
    collGet.mockResolvedValue({ docs: [] })
    const detail = await getUserDetail('missing')
    expect(detail.profile).toBeNull()
  })
})

describe('revokeEntitlement', () => {
  it('zeroes grants, marks revoked, clears expiry with merge', async () => {
    await revokeEntitlement('u1', 'crackloop')
    expect(docSet).toHaveBeenCalledWith(
      'users/u1/apps/crackloop',
      { subscription: { status: 'revoked', autoRenewing: false, expiryTimeMillis: null }, entitlements: { adFree: false, unlimitedAi: false, tier: null } },
      { merge: true },
    )
  })
})

describe('createPlanWithRazorpay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    docGet.mockResolvedValue({ exists: false })
    createPlan.mockResolvedValue({ id: 'plan_new' })
  })
  const base = { id: 'crackloop-pro-3m', appId: 'crackloop', tier: 'pro' as const, durationMonths: 3 as const, lifetime: false, pricePaise: 19900, playStorePricePaise: 24900, sort: 5 }

  it('creates razorpay plan and firestore doc for recurring', async () => {
    const plan = await createPlanWithRazorpay(base)
    expect(createPlan).toHaveBeenCalledWith({ name: 'crackloop pro 3m', amountPaise: 19900, intervalMonths: 3 })
    expect(docSet).toHaveBeenCalledWith('plans/crackloop-pro-3m', expect.objectContaining({ razorpayPlanId: 'plan_new', active: true }), undefined)
    expect(plan.razorpayPlanId).toBe('plan_new')
  })

  it('skips razorpay for lifetime', async () => {
    await createPlanWithRazorpay({ ...base, id: 'crackloop-ai-life', lifetime: true, durationMonths: null })
    expect(createPlan).not.toHaveBeenCalled()
  })

  it('rejects duplicate id, bad slug, bad price, lifetime+duration mismatch', async () => {
    docGet.mockResolvedValue({ exists: true })
    await expect(createPlanWithRazorpay(base)).rejects.toThrow(/exists/)
    docGet.mockResolvedValue({ exists: false })
    await expect(createPlanWithRazorpay({ ...base, id: 'Bad Slug!' })).rejects.toThrow(/id/)
    await expect(createPlanWithRazorpay({ ...base, pricePaise: -5 })).rejects.toThrow(/price/)
    await expect(createPlanWithRazorpay({ ...base, lifetime: true })).rejects.toThrow(/lifetime/)
  })

  it('rejects invalid tier', async () => {
    await expect(createPlanWithRazorpay({ ...base, tier: 'Bad Tier!' })).rejects.toThrow(/tier/)
  })

  it('rejects invalid durationMonths', async () => {
    await expect(createPlanWithRazorpay({ ...base, durationMonths: 5 as never })).rejects.toThrow(/durationMonths/)
  })

  it('does not write extra body keys to firestore', async () => {
    await createPlanWithRazorpay({ ...base, evil: 'x' } as never)
    const call = docSet.mock.calls[0]
    const docPayload = call[1]
    expect(docPayload).not.toHaveProperty('evil')
    expect(docPayload).toEqual(
      expect.objectContaining({
        id: base.id,
        appId: base.appId,
        tier: base.tier,
        durationMonths: base.durationMonths,
        lifetime: base.lifetime,
        pricePaise: base.pricePaise,
        playStorePricePaise: base.playStorePricePaise,
        sort: base.sort,
        active: true,
      }),
    )
  })
})

describe('updatePlanFields', () => {
  it('allows only mutable fields', async () => {
    await updatePlanFields('p1', { active: false, sort: 9 })
    expect(docSet).toHaveBeenCalledWith('plans/p1', { active: false, sort: 9 }, { merge: true })
    await expect(updatePlanFields('p1', { pricePaise: 100 } as never)).rejects.toThrow(/immutable|unknown/)
  })
})

describe('listWebhookEvents', () => {
  it('returns events with null cursor on a short page', async () => {
    collGet.mockResolvedValue({
      docs: [{ id: 'e1', data: () => ({ event: 'subscription.charged', receivedAt: 200 }) }],
    })
    const page = await listWebhookEvents()
    expect(page.events).toEqual([{ id: 'e1', event: 'subscription.charged', receivedAt: 200 }])
    expect(page.nextCursor).toBeNull()
  })

  it('returns a cursor when the page is full', async () => {
    collGet.mockResolvedValue({
      docs: [{ id: 'e2', data: () => ({ event: 'order.paid', receivedAt: 100 }) }],
    })
    const page = await listWebhookEvents(1)
    expect(page.nextCursor).toBe('100_e2')
  })
})
