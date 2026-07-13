import { describe, it, expect } from 'vitest'
import { parseSubscriptionBody, isValidTier } from './subscription-request'

describe('isValidTier', () => {
  it('accepts pro and ai', () => {
    expect(isValidTier('pro')).toBe(true)
    expect(isValidTier('ai')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isValidTier('premium')).toBe(false)
    expect(isValidTier(undefined)).toBe(false)
    expect(isValidTier(null)).toBe(false)
  })
})

describe('parseSubscriptionBody', () => {
  it('parses a valid body', () => {
    expect(parseSubscriptionBody({ appId: 'crackloop', tier: 'pro' })).toEqual({
      appId: 'crackloop',
      tier: 'pro',
    })
  })

  it('rejects a missing appId', () => {
    expect(parseSubscriptionBody({ tier: 'pro' })).toBeNull()
  })

  it('rejects an empty appId', () => {
    expect(parseSubscriptionBody({ appId: '', tier: 'pro' })).toBeNull()
  })

  it('rejects an invalid tier', () => {
    expect(parseSubscriptionBody({ appId: 'crackloop', tier: 'gold' })).toBeNull()
  })

  it('rejects a missing tier', () => {
    expect(parseSubscriptionBody({ appId: 'crackloop' })).toBeNull()
  })

  it('rejects non-object bodies', () => {
    expect(parseSubscriptionBody(null)).toBeNull()
    expect(parseSubscriptionBody('crackloop')).toBeNull()
    expect(parseSubscriptionBody(42)).toBeNull()
  })
})
