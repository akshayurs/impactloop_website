import type { Plan } from '@/config/plans'
import { adminDb } from './firebase-admin'

export const ACTIVE_SUB_STATUSES = ['created', 'authenticated', 'active', 'pending'] as const

export function isLiveStatus(status: string): boolean {
  return (ACTIVE_SUB_STATUSES as readonly string[]).includes(status)
}

/* Tier ids are stable slugs shared with the mobile app (e.g. 'pro', 'ai', future tiers).
   `entitlements.tier` carries the slug so app builds can gate features per tier; the
   boolean flags stay for backward compatibility with builds that only know adFree/unlimitedAi. */
export type Grants = { adFree: boolean; unlimitedAi: boolean; tier: string | null }

export function grantsForTier(tier: string): Grants {
  return { adFree: true, unlimitedAi: tier === 'ai', tier }
}

export const NO_GRANTS: Grants = { adFree: false, unlimitedAi: false, tier: null }

export type EntitlementDoc = {
  subscription: {
    status: string
    planId: string
    tier: string
    expiryTimeMillis: number | null
    autoRenewing: boolean
    razorpaySubscriptionId: string | null
    source: 'web'
    lastVerifiedAt: number
  }
  entitlements: Grants
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
    entitlements: live ? grantsForTier(input.plan.tier) : NO_GRANTS,
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
