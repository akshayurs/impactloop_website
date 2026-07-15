export type WebhookEffect =
  | {
      kind: 'subscription-update'
      subscriptionId: string
      status: string
      currentEndMillis: number
      paymentId: string | null
      amountPaise: number | null
    }
  | { kind: 'order-paid'; orderId: string; paymentId: string; amountPaise: number }
  | { kind: 'ignore'; reason: string }

const SUBSCRIPTION_EVENTS = new Set([
  'subscription.activated',
  'subscription.charged',
  'subscription.cancelled',
  'subscription.completed',
  'subscription.halted',
  'subscription.paused',
  'subscription.resumed',
])

export function mapWebhookEvent(body: any): WebhookEffect {
  const event = body?.event
  if (SUBSCRIPTION_EVENTS.has(event)) {
    const sub = body?.payload?.subscription?.entity
    if (!sub?.id || typeof sub.current_end !== 'number') {
      return { kind: 'ignore', reason: `malformed subscription payload for ${event}` }
    }
    const payment = body?.payload?.payment?.entity
    return {
      kind: 'subscription-update',
      subscriptionId: sub.id,
      status: String(sub.status),
      currentEndMillis: sub.current_end * 1000,
      paymentId: payment?.id ?? null,
      amountPaise: typeof payment?.amount === 'number' ? payment.amount : null,
    }
  }
  if (event === 'order.paid') {
    const order = body?.payload?.order?.entity
    const payment = body?.payload?.payment?.entity
    if (!order?.id || !payment?.id || typeof payment.amount !== 'number') {
      return { kind: 'ignore', reason: 'malformed order.paid payload' }
    }
    return { kind: 'order-paid', orderId: order.id, paymentId: payment.id, amountPaise: payment.amount }
  }
  return { kind: 'ignore', reason: `unhandled event ${event}` }
}

export function idempotencyKeyFor(body: any, headerEventId: string | null): string {
  if (headerEventId) return headerEventId
  const event = body?.event ?? 'unknown'
  const sub = body?.payload?.subscription?.entity
  const order = body?.payload?.order?.entity
  const entityId = sub?.id ?? order?.id ?? 'none'
  const suffix = sub?.current_end ?? body?.payload?.payment?.entity?.id ?? ''
  return `${event}:${entityId}:${suffix}`
}
