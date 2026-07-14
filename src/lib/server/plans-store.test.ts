import { afterEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()
vi.mock('./firebase-admin', () => ({
  adminDb: () => ({
    collection: () => ({ where: () => ({ where: () => ({ orderBy: () => ({ get }) }) }) }),
    doc: (path: string) => ({ get: () => get(path) }),
  }),
}))

import { getPlanById, getPlansFromDb } from './plans-store'

describe('plans-store fallback', () => {
  afterEach(() => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT
    get.mockReset()
  })

  it('returns static plans with null razorpayPlanId when creds missing', async () => {
    const plans = await getPlansFromDb('crackloop')
    expect(plans.length).toBeGreaterThan(0)
    expect(plans.every((p) => p.razorpayPlanId === null)).toBe(true)
  })

  it('returns firestore plans when creds present', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = '{}'
    get.mockResolvedValue({
      docs: [{ data: () => ({ id: 'p1', appId: 'crackloop', tier: 'pro', durationMonths: 1, lifetime: false, pricePaise: 7900, playStorePricePaise: 9900, active: true, sort: 1, razorpayPlanId: 'plan_x' }) }],
    })
    const plans = await getPlansFromDb('crackloop')
    expect(plans).toHaveLength(1)
    expect(plans[0].razorpayPlanId).toBe('plan_x')
  })

  it('falls back to static when query throws', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = '{}'
    get.mockRejectedValue(new Error('firestore down'))
    const plans = await getPlansFromDb('crackloop')
    expect(plans.every((p) => p.razorpayPlanId === null)).toBe(true)
  })

  it('getPlanById finds static plan without creds', async () => {
    const plan = await getPlanById('crackloop-pro-1m')
    expect(plan?.appId).toBe('crackloop')
    expect(await getPlanById('nope')).toBeNull()
  })
})
