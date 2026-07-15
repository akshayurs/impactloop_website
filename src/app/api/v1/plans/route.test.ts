import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getPlansFromDb } = vi.hoisted(() => ({ getPlansFromDb: vi.fn() }))
vi.mock('@/lib/server/plans-store', () => ({ getPlansFromDb }))

import { GET } from './route'

describe('GET /api/v1/plans', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPlansFromDb.mockResolvedValue([
      { id: 'p1', appId: 'crackloop', tier: 'pro', durationMonths: 1, lifetime: false, pricePaise: 7900, playStorePricePaise: 9900, active: true, sort: 1, razorpayPlanId: 'plan_x' },
    ])
  })

  it('400 without app param', async () => {
    expect((await GET(new Request('http://x/api/v1/plans'))).status).toBe(400)
  })

  it('400 for unknown app', async () => {
    expect((await GET(new Request('http://x/api/v1/plans?app=nope'))).status).toBe(400)
  })

  it('returns public plan fields only, with cache header', async () => {
    const res = await GET(new Request('http://x/api/v1/plans?app=crackloop'))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('max-age=300')
    const json = await res.json()
    expect(json.plans).toEqual([{ id: 'p1', tier: 'pro', durationMonths: 1, lifetime: false, pricePaise: 7900 }])
  })
})
