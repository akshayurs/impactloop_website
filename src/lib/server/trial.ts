import { adminDb } from './firebase-admin'
import { grantsForTier, type EntitlementDoc } from './entitlements'

export type TrialDoc = EntitlementDoc & { trialUsed: true }

export function buildTrialEntitlement(input: { appId: string; trialDays: number; nowMillis: number }): TrialDoc {
  return {
    subscription: {
      status: 'trial',
      planId: 'trial',
      tier: 'pro',
      expiryTimeMillis: input.nowMillis + input.trialDays * 86_400_000,
      autoRenewing: false,
      razorpaySubscriptionId: null,
      source: 'web',
      lastVerifiedAt: input.nowMillis,
    },
    entitlements: grantsForTier('pro'),
    trialUsed: true,
  }
}

export async function grantTrial(uid: string, appId: string, trialDays: number, nowMillis: number): Promise<void> {
  await adminDb().doc(`users/${uid}/apps/${appId}`).set(buildTrialEntitlement({ appId, trialDays, nowMillis }), { merge: true })
}
