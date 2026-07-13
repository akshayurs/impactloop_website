import { describe, it, expect } from 'vitest'
import { resolveSubscriptionContext } from './razorpay-webhook-context'

describe('resolveSubscriptionContext', () => {
  it('resolves from notes when complete', () => {
    expect(
      resolveSubscriptionContext({ uid: 'u1', appId: 'crackloop', tier: 'pro' }, null)
    ).toEqual({ uid: 'u1', appId: 'crackloop', tier: 'pro' })
  })

  it('falls back to the index doc when notes are missing', () => {
    expect(
      resolveSubscriptionContext(undefined, { uid: 'u1', appId: 'crackloop', tier: 'ai' })
    ).toEqual({ uid: 'u1', appId: 'crackloop', tier: 'ai' })
  })

  it('falls back to the index doc when notes are incomplete', () => {
    expect(
      resolveSubscriptionContext({ uid: 'u1' }, { uid: 'u1', appId: 'crackloop', tier: 'ai' })
    ).toEqual({ uid: 'u1', appId: 'crackloop', tier: 'ai' })
  })

  it('prefers notes over the index doc when both are present', () => {
    expect(
      resolveSubscriptionContext(
        { uid: 'u1', appId: 'crackloop', tier: 'pro' },
        { uid: 'u2', appId: 'other', tier: 'ai' }
      )
    ).toEqual({ uid: 'u1', appId: 'crackloop', tier: 'pro' })
  })

  it('returns null when both notes and index doc are missing appId', () => {
    expect(resolveSubscriptionContext({ uid: 'u1', tier: 'pro' }, null)).toBeNull()
  })

  it('returns null for an invalid tier in both sources', () => {
    expect(
      resolveSubscriptionContext(
        { uid: 'u1', appId: 'crackloop', tier: 'gold' },
        { uid: 'u1', appId: 'crackloop', tier: 'gold' }
      )
    ).toBeNull()
  })

  it('returns null when neither source is an object', () => {
    expect(resolveSubscriptionContext(null, undefined)).toBeNull()
    expect(resolveSubscriptionContext('sub_123', 42)).toBeNull()
  })

  it('returns null for an empty uid or appId', () => {
    expect(resolveSubscriptionContext({ uid: '', appId: 'crackloop', tier: 'pro' }, null)).toBeNull()
    expect(resolveSubscriptionContext({ uid: 'u1', appId: '', tier: 'pro' }, null)).toBeNull()
  })
})
