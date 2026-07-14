import type { Plan } from '@/config/plans'
import { adminDb } from './firebase-admin'

export const ACTIVE_SUB_STATUSES = ['created', 'authenticated', 'active', 'pending'] as const

export function isLiveStatus(status: string): boolean {
  return (ACTIVE_SUB_STATUSES as readonly string[]).includes(status)
}

export function grantsForTier(tier: 'pro' | 'ai'): { adFree: boolean; unlimitedAi: boolean } {
  return tier === 'ai' ? { adFree: true, unlimitedAi: true } : { adFree: true, unlimitedAi: false }
}

export type EntitlementDoc = {
  subscription: {
    status: string
    planId: string
    tier: 'pro' | 'ai'
    expiryTimeMillis: number | null
    autoRenewing: boolean
    razorpaySubscriptionId: string | null
    source: 'web'
    lastVerifiedAt: number
  }
  entitlements: { adFree: boolean; unlimitedAi: boolean }
}

export function buildSubscriptionEntitlement(input: {
  plan: Plan
  status: string
  currentEndMillis: number
  razorpaySubscriptionId: string
  nowMillis: number
}): EntitlementDoc {
  const live = isLiveStatus(input.status)
  return {
    subscription: {
      status: input.status,
      planId: input.plan.id,
      tier: input.plan.tier,
      expiryTimeMillis: input.currentEndMillis,
      autoRenewing: live,
      razorpaySubscriptionId: input.razorpaySubscriptionId,
      source: 'web',
      lastVerifiedAt: input.nowMillis,
    },
    entitlements: live ? grantsForTier(input.plan.tier) : { adFree: false, unlimitedAi: false },
  }
}

export function buildLifetimeEntitlement(input: { plan: Plan; nowMillis: number }): EntitlementDoc {
  return {
    subscription: {
      status: 'lifetime',
      planId: input.plan.id,
      tier: input.plan.tier,
      expiryTimeMillis: null,
      autoRenewing: false,
      razorpaySubscriptionId: null,
      source: 'web',
      lastVerifiedAt: input.nowMillis,
    },
    entitlements: grantsForTier(input.plan.tier),
  }
}

export async function writeEntitlement(uid: string, appId: string, doc: EntitlementDoc): Promise<void> {
  await adminDb().doc(`users/${uid}/apps/${appId}`).set(doc, { merge: true })
}
