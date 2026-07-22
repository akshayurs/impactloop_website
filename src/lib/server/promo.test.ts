import { describe, expect, it } from 'vitest'
import {
  PROMO_CODE_RE,
  commissionForPlan,
  discountedPaise,
  expiryFromNow,
  freeDaysFor,
  isPromoUsable,
  normalizeCode,
  type PromoDoc,
} from './promo'

const doc: PromoDoc = { code: 'AKSHAY10', ownerUid: 'inf1', appId: 'crackloop', active: true, createdAt: 0, expiresAt: 100 }

describe('code shape', () => {
  it('normalizes and validates', () => {
    expect(normalizeCode('  akshay10 ')).toBe('AKSHAY10')
    expect(PROMO_CODE_RE.test('AKSHAY10')).toBe(true)
    expect(PROMO_CODE_RE.test('ab')).toBe(false)
    expect(PROMO_CODE_RE.test('HAS SPACE')).toBe(false)
  })
})

describe('isPromoUsable', () => {
  it('ok for active unexpired', () => expect(isPromoUsable(doc, 50)).toEqual({ ok: true }))
  it('not-found / inactive / expired reasons', () => {
    expect(isPromoUsable(undefined, 50)).toEqual({ ok: false, reason: 'not-found' })
    expect(isPromoUsable({ ...doc, active: false }, 50)).toEqual({ ok: false, reason: 'inactive' })
    expect(isPromoUsable(doc, 101)).toEqual({ ok: false, reason: 'expired' })
  })
})

describe('money math', () => {
  it('discountedPaise rounds correctly', () => {
    expect(discountedPaise(7900, 10)).toBe(7110)
    expect(discountedPaise(9999, 33)).toBe(6699)
    expect(discountedPaise(7900, 0)).toBe(7900)
  })
  it('rejects invalid inputs', () => {
    expect(() => discountedPaise(79.5, 10)).toThrow()
    expect(() => discountedPaise(7900, 95)).toThrow()
    expect(() => discountedPaise(7900, -1)).toThrow()
  })
  it('freeDaysFor scales with duration and pct', () => {
    expect(freeDaysFor(1, 10)).toBe(3)
    expect(freeDaysFor(12, 10)).toBe(36)
    expect(freeDaysFor(1, 0)).toBe(0)
  })
  it('commissionForPlan looks up per-plan rate, 0 default', () => {
    const rates = { signupPaise: 500, perPlan: { 'crackloop-pro-1m': 1000 } }
    expect(commissionForPlan(rates, 'crackloop-pro-1m')).toBe(1000)
    expect(commissionForPlan(rates, 'other')).toBe(0)
  })
  it('expiryFromNow adds 30-day months', () => {
    expect(expiryFromNow(0, 3)).toBe(3 * 30 * 86_400_000)
  })
})
