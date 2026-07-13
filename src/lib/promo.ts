import { adminDb } from './firebase-admin'

export type PromoCode = {
  code: string
  creatorId: string
  appId: string | null
  discountPct: number
  commissionPct: number
  active: boolean
  maxRedemptions: number
  redeemed: number
}

/** gross/return values are integer minor units (paise). discountPct is a whole percent. */
export function applyPromo(gross: number, discountPct: number): { discountAmount: number; netAmount: number } {
  const discountAmount = Math.round((gross * discountPct) / 100)
  return { discountAmount, netAmount: gross - discountAmount }
}

/** Commission on the net (first payment only — caller enforces "first"). netAmount integer paise. */
export function commissionFor(netAmount: number, commissionPct: number): number {
  return Math.round((netAmount * commissionPct) / 100)
}

/** A promo is usable only if active AND has a numeric redemption cap not yet reached.
 *  Fails CLOSED: a missing/non-numeric maxRedemptions is treated as unusable (live-money safety). */
export function isPromoUsable(p: PromoCode): boolean {
  if (!p.active) return false
  if (typeof p.maxRedemptions !== 'number' || !Number.isFinite(p.maxRedemptions)) return false
  const redeemed = typeof p.redeemed === 'number' ? p.redeemed : 0
  return redeemed < p.maxRedemptions
}

/** Reads promoCodes/{code}; returns it only if active and under maxRedemptions, else null. */
export async function validatePromo(code: string): Promise<PromoCode | null> {
  const snap = await adminDb().doc(`promoCodes/${code}`).get()
  if (!snap.exists) return null
  const p = snap.data() as PromoCode
  if (!isPromoUsable(p)) return null
  return { ...p, code }
}
