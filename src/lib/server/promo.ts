export const PROMO_CODE_RE = /^[A-Z0-9]{4,16}$/

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase()
}

export type PromoDoc = {
  code: string
  ownerUid: string
  /** App this code belongs to; a code is only valid for its own app. */
  appId: string
  active: boolean
  createdAt: number
  expiresAt: number
}

export function isPromoUsable(
  doc: PromoDoc | undefined,
  nowMillis: number,
): { ok: true } | { ok: false; reason: 'not-found' | 'inactive' | 'expired' } {
  if (!doc) return { ok: false, reason: 'not-found' }
  if (!doc.active) return { ok: false, reason: 'inactive' }
  if (nowMillis > doc.expiresAt) return { ok: false, reason: 'expired' }
  return { ok: true }
}

export function discountedPaise(pricePaise: number, discountPct: number): number {
  if (!Number.isInteger(pricePaise) || pricePaise < 0) throw new Error('pricePaise must be non-negative integer')
  if (!Number.isInteger(discountPct) || discountPct < 0 || discountPct > 90) {
    throw new Error('discountPct must be integer 0-90')
  }
  return Math.round((pricePaise * (100 - discountPct)) / 100)
}

export function freeDaysFor(durationMonths: number, discountPct: number): number {
  if (!Number.isInteger(discountPct) || discountPct < 0 || discountPct > 90) {
    throw new Error('discountPct must be integer 0-90')
  }
  return Math.max(0, Math.round((durationMonths * 30 * discountPct) / 100))
}

export function commissionForPlan(rates: { signupPaise: number; perPlan?: Record<string, number> }, planId: string): number {
  return rates.perPlan?.[planId] ?? 0
}

export function expiryFromNow(nowMillis: number, months: number): number {
  return nowMillis + months * 30 * 86_400_000
}
