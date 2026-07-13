import { describe, it, expect } from 'vitest'
import { applyPromo, commissionFor } from './promo'

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
