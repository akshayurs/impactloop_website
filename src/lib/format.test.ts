import { describe, expect, it } from 'vitest'
import { formatINR } from './format'

describe('formatINR', () => {
  it('formats whole rupees without decimals', () => {
    expect(formatINR(9900)).toBe('₹99')
    expect(formatINR(0)).toBe('₹0')
    expect(formatINR(129900)).toBe('₹1,299')
  })
  it('formats fractional rupees with two decimals', () => {
    expect(formatINR(9950)).toBe('₹99.50')
  })
  it('formats negative amounts (e.g. an over-paid partner balance)', () => {
    expect(formatINR(-129900)).toBe('-₹1,299')
    expect(formatINR(-9950)).toBe('-₹99.50')
  })
  it('throws on non-integer paise', () => {
    expect(() => formatINR(99.5)).toThrow()
  })
})
