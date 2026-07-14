import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createOrder,
  createSubscription,
  cancelSubscriptionAtCycleEnd,
  RazorpayError,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from './razorpay'

const SECRET = 'whsec_test'
function sign(body: string, secret = SECRET) {
  return createHmac('sha256', secret).update(body).digest('hex')
}

describe('verifyWebhookSignature', () => {
  it('accepts a valid signature', () => {
    const body = '{"event":"subscription.charged"}'
    expect(verifyWebhookSignature(body, sign(body), SECRET)).toBe(true)
  })
  it('rejects a tampered body', () => {
    expect(verifyWebhookSignature('{"event":"x"}', sign('{"event":"y"}'), SECRET)).toBe(false)
  })
  it('rejects wrong-length signature without throwing', () => {
    expect(verifyWebhookSignature('body', 'deadbeef', SECRET)).toBe(false)
  })
})

describe('verifyPaymentSignature', () => {
  it('accepts valid order|payment signature', () => {
    const sig = sign('order_1|pay_1', 'keysecret')
    expect(verifyPaymentSignature({ orderId: 'order_1', paymentId: 'pay_1', signature: sig }, 'keysecret')).toBe(true)
  })
  it('rejects mismatched payment id', () => {
    const sig = sign('order_1|pay_1', 'keysecret')
    expect(verifyPaymentSignature({ orderId: 'order_1', paymentId: 'pay_2', signature: sig }, 'keysecret')).toBe(false)
  })
})

describe('REST client', () => {
  beforeEach(() => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_key'
    process.env.RAZORPAY_KEY_SECRET = 'secret'
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.RAZORPAY_KEY_ID
    delete process.env.RAZORPAY_KEY_SECRET
  })

  it('createSubscription posts plan and count with basic auth', async () => {
    ;(fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ id: 'sub_1', status: 'created' }), { status: 200 }),
    )
    const res = await createSubscription({ razorpayPlanId: 'plan_x', totalCount: 12, notes: { uid: 'u1' } })
    expect(res).toEqual({ id: 'sub_1', status: 'created' })
    const [url, init] = (fetch as any).mock.calls[0]
    expect(url).toBe('https://api.razorpay.com/v1/subscriptions')
    expect(init.headers.Authorization).toBe('Basic ' + Buffer.from('rzp_test_key:secret').toString('base64'))
    expect(JSON.parse(init.body)).toMatchObject({ plan_id: 'plan_x', total_count: 12, customer_notify: 1 })
  })

  it('createOrder posts integer paise amount', async () => {
    ;(fetch as any).mockResolvedValue(new Response(JSON.stringify({ id: 'order_1', amount: 199900 }), { status: 200 }))
    const res = await createOrder({ amountPaise: 199900, receipt: 'r1', notes: {} })
    expect(res).toEqual({ id: 'order_1', amount: 199900 })
    const [, init] = (fetch as any).mock.calls[0]
    expect(JSON.parse(init.body)).toMatchObject({ amount: 199900, currency: 'INR', receipt: 'r1' })
  })

  it('cancel hits cancel endpoint with cycle-end flag', async () => {
    ;(fetch as any).mockResolvedValue(new Response(JSON.stringify({ id: 'sub_1', status: 'cancelled' }), { status: 200 }))
    await cancelSubscriptionAtCycleEnd('sub_1')
    const [url, init] = (fetch as any).mock.calls[0]
    expect(url).toBe('https://api.razorpay.com/v1/subscriptions/sub_1/cancel')
    expect(JSON.parse(init.body)).toEqual({ cancel_at_cycle_end: 1 })
  })

  it('throws RazorpayError with description on non-2xx', async () => {
    ;(fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ error: { description: 'Bad plan id' } }), { status: 400 }),
    )
    await expect(createSubscription({ razorpayPlanId: 'x', totalCount: 1, notes: {} })).rejects.toMatchObject({
      status: 400,
      message: 'Bad plan id',
    })
  })

  it('throws when keys missing', async () => {
    delete process.env.RAZORPAY_KEY_ID
    await expect(createOrder({ amountPaise: 1, receipt: 'r', notes: {} })).rejects.toThrow(/RAZORPAY_KEY_ID/)
  })
})
