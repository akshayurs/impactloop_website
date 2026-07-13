import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from './firebase-admin'

// Mirrors StudyAppTemplate `functions/src/subscription.ts` (PRODUCT_TIER +
// PRODUCT_ENTITLEMENTS). This mapping is locked by #4A — keep it byte-for-byte
// in sync with that file rather than diverging per-app.

export type Grants = { adFree: boolean; unlimitedAi: boolean }

const PRODUCT_TIER: Record<string, 'standard' | 'higher'> = {
  ai_standard_monthly: 'standard',
  ai_higher_monthly: 'higher',
  pro_monthly: 'standard',
  ai_monthly: 'higher',
}

const PRODUCT_ENTITLEMENTS: Record<string, Grants> = {
  ai_standard_monthly: { adFree: false, unlimitedAi: true },
  ai_higher_monthly: { adFree: true, unlimitedAi: true },
  pro_monthly: { adFree: true, unlimitedAi: false },
  ai_monthly: { adFree: true, unlimitedAi: true },
}

export function entitlementsForProduct(productId: string): Grants {
  return PRODUCT_ENTITLEMENTS[productId] ?? { adFree: false, unlimitedAi: false }
}

export function tierForProduct(productId: string): 'standard' | 'higher' | null {
  return PRODUCT_TIER[productId] ?? null
}

/** Entitlement grants gated by whether the subscription is currently active.
 *  When inactive, all grants are false regardless of product. */
export function gatedEntitlements(productId: string, active: boolean): Grants {
  const grants = entitlementsForProduct(productId)
  return {
    unlimitedAi: active && grants.unlimitedAi,
    adFree: active && grants.adFree,
  }
}

export async function writeEntitlement(
  uid: string,
  appId: string,
  args: {
    productId: string
    status: string
    expiryTimeMillis: number
    autoRenewing: boolean
    subscriptionId: string
    active: boolean
  }
): Promise<void> {
  await adminDb()
    .doc(`users/${uid}/apps/${appId}`)
    .set(
      {
        subscription: {
          tier: tierForProduct(args.productId),
          status: args.status,
          productId: args.productId,
          expiryTimeMillis: args.expiryTimeMillis,
          autoRenewing: args.autoRenewing,
          razorpaySubscriptionId: args.subscriptionId,
          source: 'web',
          lastVerifiedAt: FieldValue.serverTimestamp(),
        },
        entitlements: gatedEntitlements(args.productId, args.active),
      },
      { merge: true }
    )
}
