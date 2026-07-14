import { describe, expect, it } from 'vitest'
import { idempotencyKeyFor, mapWebhookEvent } from './webhook-events'

function subEvent(event: string, overrides: any = {}) {
  return {
    event,
    payload: {
      subscription: { entity: { id: 'sub_1', status: overrides.status ?? 'active', current_end: 1750000000, ...overrides.sub } },
      ...(overrides.payment ? { payment: { entity: { id: 'pay_1', amount: 7900, ...overrides.payment } } } : {}),
    },
  }
}

describe('mapWebhookEvent', () => {
  it('subscription.activated -> subscription-update without payment', () => {
    expect(mapWebhookEvent(subEvent('subscription.activated'))).toEqual({
      kind: 'subscription-update', subscriptionId: 'sub_1', status: 'active',
      currentEndMillis: 1750000000000, paymentId: null, amountPaise: null,
    })
  })
  it('subscription.charged carries payment id and amount', () => {
    expect(mapWebhookEvent(subEvent('subscription.charged', { payment: {} }))).toEqual({
      kind: 'subscription-update', subscriptionId: 'sub_1', status: 'active',
      currentEndMillis: 1750000000000, paymentId: 'pay_1', amountPaise: 7900,
    })
  })
  it('subscription.halted maps status verbatim', () => {
    const effect = mapWebhookEvent(subEvent('subscription.halted', { status: 'halted' }))
    expect(effect).toMatchObject({ kind: 'subscription-update', status: 'halted' })
  })
  it('order.paid -> order-paid', () => {
    const body = { event: 'order.paid', payload: { order: { entity: { id: 'order_1' } }, payment: { entity: { id: 'pay_9', amount: 199900 } } } }
    expect(mapWebhookEvent(body)).toEqual({ kind: 'order-paid', orderId: 'order_1', paymentId: 'pay_9', amountPaise: 199900 })
  })
  it('unknown events are ignored with reason', () => {
    expect(mapWebhookEvent({ event: 'refund.processed', payload: {} })).toEqual({ kind: 'ignore', reason: 'unhandled event refund.processed' })
  })
  it('malformed subscription payload is ignored, not thrown', () => {
    expect(mapWebhookEvent({ event: 'subscription.charged', payload: {} })).toMatchObject({ kind: 'ignore' })
  })
})

describe('idempotencyKeyFor', () => {
  it('prefers header event id', () => {
    expect(idempotencyKeyFor(subEvent('subscription.charged'), 'evt_123')).toBe('evt_123')
  })
  it('falls back to composite key', () => {
    expect(idempotencyKeyFor(subEvent('subscription.charged'), null)).toBe('subscription.charged:sub_1:1750000000')
  })
})
