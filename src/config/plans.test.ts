import { describe, expect, it } from 'vitest'
import { getPlansFromDb as getPlans } from '@/lib/server/plans-store'

describe('getPlans', () => {
  it('returns active crackloop plans sorted by sort key', async () => {
    const plans = await getPlans('crackloop')
    expect(plans.length).toBeGreaterThan(0)
    expect(plans.every((p) => p.active && p.appId === 'crackloop')).toBe(true)
    expect(plans.map((p) => p.sort)).toEqual([...plans.map((p) => p.sort)].sort((a, b) => a - b))
  })
  it('lifetime plans have null duration and integer paise price', async () => {
    const plans = await getPlans('crackloop')
    const lifetime = plans.filter((p) => p.lifetime)
    for (const p of lifetime) {
      expect(p.durationMonths).toBeNull()
      expect(Number.isInteger(p.pricePaise)).toBe(true)
    }
  })
  it('returns empty for unknown app', async () => {
    expect(await getPlans('nope')).toEqual([])
  })
})
