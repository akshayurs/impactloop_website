// Pure resolver for the webhook route: figures out which user/app/tier a Razorpay
// subscription event belongs to. Prefers `subscription.entity.notes` (set at
// checkout in src/app/api/razorpay/subscription/route.ts); falls back to the
// `razorpaySubscriptions/{subId}` index doc written by that same route when notes
// are missing or stripped by Razorpay.
import { isValidTier, type Tier } from './subscription-request'

export type SubscriptionContext = { uid: string; appId: string; tier: Tier }

function fromRecord(rec: unknown): SubscriptionContext | null {
  if (!rec || typeof rec !== 'object') return null
  const { uid, appId, tier } = rec as Record<string, unknown>
  if (typeof uid !== 'string' || uid.length === 0) return null
  if (typeof appId !== 'string' || appId.length === 0) return null
  if (!isValidTier(tier)) return null
  return { uid, appId, tier }
}

export function resolveSubscriptionContext(
  notes: unknown,
  indexDoc: unknown
): SubscriptionContext | null {
  return fromRecord(notes) ?? fromRecord(indexDoc)
}
