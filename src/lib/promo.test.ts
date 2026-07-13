import { describe, it, expect } from 'vitest'
import { applyPromo, commissionFor, isPromoUsable, type PromoCode } from './promo'

describe('applyPromo', () => {
  it('applies discount correctly: 10000 with 20%', () => {
    const result = applyPromo(10000, 20)
    expect(result).toEqual({ discountAmount: 2000, netAmount: 8000 })
  })

  it('rounds discount correctly: 9999 with 20%', () => {
    const result = applyPromo(9999, 20)
    expect(result).toEqual({ discountAmount: 2000, netAmount: 7999 })
  })

  it('handles 0% discount', () => {
    const result = applyPromo(10000, 0)
    expect(result).toEqual({ discountAmount: 0, netAmount: 10000 })
  })

  it('handles 100% discount', () => {
    const result = applyPromo(10000, 100)
    expect(result).toEqual({ discountAmount: 10000, netAmount: 0 })
  })
})

describe('commissionFor', () => {
  it('calculates commission: 8000 with 25%', () => {
    const result = commissionFor(8000, 25)
    expect(result).toBe(2000)
  })

  it('rounds commission correctly: 7999 with 10%', () => {
    const result = commissionFor(7999, 10)
    expect(result).toBe(800)
  })

  it('handles 0% commission', () => {
    const result = commissionFor(8000, 0)
    expect(result).toBe(0)
  })
})

describe('isPromoUsable', () => {
  const makePromo = (overrides: Partial<PromoCode> = {}): PromoCode => ({
    code: 'TEST',
    creatorId: 'creator1',
    appId: null,
    discountPct: 10,
    commissionPct: 5,
    active: true,
    maxRedemptions: 100,
    redeemed: 0,
    ...overrides,
  })

  it('returns true when active and under redemption cap', () => {
    const promo = makePromo({ redeemed: 0, maxRedemptions: 100 })
    expect(isPromoUsable(promo)).toBe(true)
  })

  it('returns false when redemption cap is exhausted', () => {
    const promo = makePromo({ redeemed: 100, maxRedemptions: 100 })
    expect(isPromoUsable(promo)).toBe(false)
  })

  it('returns false when redeemed exceeds max', () => {
    const promo = makePromo({ redeemed: 150, maxRedemptions: 100 })
    expect(isPromoUsable(promo)).toBe(false)
  })

  it('returns false when inactive', () => {
    const promo = makePromo({ active: false, redeemed: 0, maxRedemptions: 100 })
    expect(isPromoUsable(promo)).toBe(false)
  })

  it('returns false when maxRedemptions is undefined (fails closed)', () => {
    const promo = makePromo({ maxRedemptions: undefined as any })
    expect(isPromoUsable(promo)).toBe(false)
  })

  it('returns false when maxRedemptions is not a number (fails closed)', () => {
    const promo = makePromo({ maxRedemptions: null as any })
    expect(isPromoUsable(promo)).toBe(false)
  })
})
