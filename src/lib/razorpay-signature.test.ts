import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { verifyWebhookSignature } from './razorpay-signature'

describe('verifyWebhookSignature', () => {
  it('should verify a valid webhook signature', () => {
    const body = '{"event":"subscription.charged"}'
    const secret = 'whsec_test_secret'
    const expected = createHmac('sha256', secret)
      .update(body)
      .digest('hex')

    expect(verifyWebhookSignature(body, expected, secret)).toBe(true)
  })

  it('should reject a tampered body', () => {
    const body = '{"event":"subscription.charged"}'
    const secret = 'whsec_test_secret'
    const signature = createHmac('sha256', secret)
      .update(body)
      .digest('hex')

    expect(verifyWebhookSignature(body + 'x', signature, secret)).toBe(false)
  })

  it('should reject a wrong secret', () => {
    const body = '{"event":"subscription.charged"}'
    const secret = 'whsec_test_secret'
    const signature = createHmac('sha256', secret)
      .update(body)
      .digest('hex')

    expect(verifyWebhookSignature(body, signature, 'wrong_secret')).toBe(false)
  })

  it('should reject an empty signature', () => {
    const body = '{"event":"subscription.charged"}'
    const secret = 'whsec_test_secret'

    expect(verifyWebhookSignature(body, '', secret)).toBe(false)
  })

  it('should not throw on malformed signature', () => {
    const body = '{"event":"subscription.charged"}'
    const secret = 'whsec_test_secret'

    expect(() => {
      verifyWebhookSignature(body, '!!!invalid!!!', secret)
    }).not.toThrow()
  })
})
