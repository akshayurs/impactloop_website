// Pure body-validation for POST /api/razorpay/subscription — kept separate from
// the route handler so it's unit-testable without a request/Firebase context.

export type Tier = 'pro' | 'ai'

export function isValidTier(tier: unknown): tier is Tier {
  return tier === 'pro' || tier === 'ai'
}

export type SubscriptionRequestBody = { appId: string; tier: Tier }

/** Returns the parsed body, or null if `appId`/`tier` are missing or malformed. */
export function parseSubscriptionBody(body: unknown): SubscriptionRequestBody | null {
  if (!body || typeof body !== 'object') return null
  const { appId, tier } = body as Record<string, unknown>
  if (typeof appId !== 'string' || appId.length === 0) return null
  if (!isValidTier(tier)) return null
  return { appId, tier }
}
