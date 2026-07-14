export type Plan = {
  id: string
  appId: string
  tier: 'pro' | 'ai'
  durationMonths: 1 | 3 | 6 | 12 | null
  lifetime: boolean
  pricePaise: number
  playStorePricePaise: number | null
  active: boolean
  sort: number
}

export type StoredPlan = Plan & { razorpayPlanId: string | null }

export const STATIC_PLANS: Plan[] = [
  { id: 'crackloop-pro-1m', appId: 'crackloop', tier: 'pro', durationMonths: 1, lifetime: false, pricePaise: 7900, playStorePricePaise: 9900, active: true, sort: 1 },
  { id: 'crackloop-pro-12m', appId: 'crackloop', tier: 'pro', durationMonths: 12, lifetime: false, pricePaise: 79900, playStorePricePaise: 99900, active: true, sort: 2 },
  { id: 'crackloop-pro-life', appId: 'crackloop', tier: 'pro', durationMonths: null, lifetime: true, pricePaise: 199900, playStorePricePaise: null, active: true, sort: 3 },
  { id: 'crackloop-ai-1m', appId: 'crackloop', tier: 'ai', durationMonths: 1, lifetime: false, pricePaise: 15900, playStorePricePaise: 19900, active: true, sort: 4 },
]

export async function getPlans(appId: string): Promise<Plan[]> {
  if (typeof window !== 'undefined') {
    throw new Error('getPlans is server-only')
  }
  const { getPlansFromDb } = await import('@/lib/server/plans-store')
  return getPlansFromDb(appId)
}
