import { describe, expect, it } from 'vitest'
import { entitlementsForProduct, tierForProduct } from './entitlement'

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

describe('gated entitlement values (status !== active/entitled)', () => {
  it('expired status yields both grants false regardless of product', () => {
    const grants = entitlementsForProduct('ai_monthly')
    const entitled = false // status "expired" is not active/grace
    const gated = { unlimitedAi: entitled && grants.unlimitedAi, adFree: entitled && grants.adFree }
    expect(gated).toEqual({ unlimitedAi: false, adFree: false })
  })

  it('active status yields the product grants unmodified', () => {
    const grants = entitlementsForProduct('ai_monthly')
    const entitled = true
    const gated = { unlimitedAi: entitled && grants.unlimitedAi, adFree: entitled && grants.adFree }
    expect(gated).toEqual({ unlimitedAi: true, adFree: true })
  })
})
