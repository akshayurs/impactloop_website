import { describe, expect, it } from 'vitest'
import { entitlementsForProduct, gatedEntitlements, isLiveSubscription, tierForProduct } from './entitlement'

// Truth table mirrored verbatim from StudyAppTemplate `functions/src/subscription.ts`
// (PRODUCT_TIER + PRODUCT_ENTITLEMENTS). Do not diverge from that source of truth.

describe('entitlementsForProduct', () => {
  it('ai_standard_monthly -> adFree:false, unlimitedAi:true', () => {
    expect(entitlementsForProduct('ai_standard_monthly')).toEqual({ adFree: false, unlimitedAi: true })
  })

  it('ai_higher_monthly -> adFree:true, unlimitedAi:true', () => {
    expect(entitlementsForProduct('ai_higher_monthly')).toEqual({ adFree: true, unlimitedAi: true })
  })

  it('pro_monthly -> adFree:true, unlimitedAi:false', () => {
    expect(entitlementsForProduct('pro_monthly')).toEqual({ adFree: true, unlimitedAi: false })
  })

  it('ai_monthly -> adFree:true, unlimitedAi:true', () => {
    expect(entitlementsForProduct('ai_monthly')).toEqual({ adFree: true, unlimitedAi: true })
  })

  it('unknown product id -> default adFree:false, unlimitedAi:false', () => {
    expect(entitlementsForProduct('some_unknown_product')).toEqual({ adFree: false, unlimitedAi: false })
  })
})

describe('tierForProduct', () => {
  it('ai_standard_monthly -> standard', () => {
    expect(tierForProduct('ai_standard_monthly')).toBe('standard')
  })

  it('ai_higher_monthly -> higher', () => {
    expect(tierForProduct('ai_higher_monthly')).toBe('higher')
  })

  it('pro_monthly -> standard', () => {
    expect(tierForProduct('pro_monthly')).toBe('standard')
  })

  it('ai_monthly -> higher', () => {
    expect(tierForProduct('ai_monthly')).toBe('higher')
  })

  it('unknown product id -> null', () => {
    expect(tierForProduct('some_unknown_product')).toBeNull()
  })
})

describe('gatedEntitlements', () => {
  it('active ai_monthly -> both grants true', () => {
    expect(gatedEntitlements('ai_monthly', true)).toEqual({ unlimitedAi: true, adFree: true })
  })

  it('inactive ai_monthly -> both grants forced false despite product grants', () => {
    expect(gatedEntitlements('ai_monthly', false)).toEqual({ unlimitedAi: false, adFree: false })
  })

  it('active pro_monthly -> per-product grants preserved', () => {
    expect(gatedEntitlements('pro_monthly', true)).toEqual({ unlimitedAi: false, adFree: true })
  })

  it('active unknown product id -> both grants false', () => {
    expect(gatedEntitlements('unknown_id', true)).toEqual({ unlimitedAi: false, adFree: false })
  })
})

describe('isLiveSubscription', () => {
  it('status active + id -> true', () => {
    expect(isLiveSubscription({ status: 'active', razorpaySubscriptionId: 'sub_1' })).toBe(true)
  })

  it('no razorpaySubscriptionId -> false', () => {
    expect(isLiveSubscription({ status: 'active' })).toBe(false)
  })

  it('status cancelled -> false', () => {
    expect(isLiveSubscription({ status: 'cancelled', razorpaySubscriptionId: 'sub_1' })).toBe(false)
  })

  it('status canceled -> false', () => {
    expect(isLiveSubscription({ status: 'canceled', razorpaySubscriptionId: 'sub_1' })).toBe(false)
  })

  it('status completed -> false', () => {
    expect(isLiveSubscription({ status: 'completed', razorpaySubscriptionId: 'sub_1' })).toBe(false)
  })

  it('status expired -> false', () => {
    expect(isLiveSubscription({ status: 'expired', razorpaySubscriptionId: 'sub_1' })).toBe(false)
  })

  it('undefined sub -> false', () => {
    expect(isLiveSubscription(undefined)).toBe(false)
  })

  it('null sub -> false', () => {
    expect(isLiveSubscription(null)).toBe(false)
  })
})
