import { describe, it, expect } from 'vitest'
import { mapSubscriptionEvent } from './razorpay-events'

describe('mapSubscriptionEvent', () => {
  it('maps subscription.charged to active: true', () => {
    expect(mapSubscriptionEvent('subscription.charged')).toEqual({ active: true })
  })

  it('maps subscription.activated to active: true', () => {
    expect(mapSubscriptionEvent('subscription.activated')).toEqual({ active: true })
  })

  it('maps subscription.cancelled to active: false', () => {
    expect(mapSubscriptionEvent('subscription.cancelled')).toEqual({ active: false })
  })

  it('maps subscription.halted to active: false', () => {
    expect(mapSubscriptionEvent('subscription.halted')).toEqual({ active: false })
  })

  it('maps subscription.completed to active: false', () => {
    expect(mapSubscriptionEvent('subscription.completed')).toEqual({ active: false })
  })

  it('returns null for subscription.pending (dunning in progress)', () => {
    expect(mapSubscriptionEvent('subscription.pending')).toBeNull()
  })

  it('returns null for unrelated event types', () => {
    expect(mapSubscriptionEvent('payment.captured')).toBeNull()
  })

  it('returns null for unknown events', () => {
    expect(mapSubscriptionEvent('nonsense')).toBeNull()
  })
})
