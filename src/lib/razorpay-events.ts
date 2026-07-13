/** Maps a Razorpay subscription webhook event name to an entitlement state.
 *  { active: true } → grant; { active: false } → revoke; null → ignore.
 *  NOTE: event names per Razorpay recurring-subscription webhooks. Verify the
 *  exact set against current Razorpay docs before go-live (the [TO-CONFIRM] in the plan). */
export type EventEffect = { active: boolean } | null

const ACTIVATE = new Set(['subscription.charged', 'subscription.activated'])
const DEACTIVATE = new Set(['subscription.cancelled', 'subscription.halted', 'subscription.completed'])

export function mapSubscriptionEvent(event: string): EventEffect {
  if (ACTIVATE.has(event)) return { active: true }
  if (DEACTIVATE.has(event)) return { active: false }
  return null
}
