import { createHmac, timingSafeEqual } from 'node:crypto'

const BASE = 'https://api.razorpay.com/v1'

export class RazorpayError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

function authHeader(): string {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId) throw new Error('RAZORPAY_KEY_ID env missing')
  if (!keySecret) throw new Error('RAZORPAY_KEY_SECRET env missing')
  return 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64')
}

async function rzpFetch(path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new RazorpayError(json?.error?.description ?? `razorpay ${res.status}`, res.status)
  }
  return json
}

export async function createSubscription(input: {
  razorpayPlanId: string
  totalCount: number
  notes: Record<string, string>
}): Promise<{ id: string; status: string }> {
  const json = await rzpFetch('/subscriptions', {
    plan_id: input.razorpayPlanId,
    total_count: input.totalCount,
    customer_notify: 1,
    notes: input.notes,
  })
  return { id: json.id, status: json.status }
}

export async function createPlan(input: {
  name: string
  amountPaise: number
  intervalMonths: number
}): Promise<{ id: string }> {
  const json = await rzpFetch('/plans', {
    period: 'monthly',
    interval: input.intervalMonths,
    item: { name: input.name, amount: input.amountPaise, currency: 'INR' },
  })
  return { id: json.id }
}

export async function createOrder(input: {
  amountPaise: number
  receipt: string
  notes: Record<string, string>
}): Promise<{ id: string; amount: number }> {
  const json = await rzpFetch('/orders', {
    amount: input.amountPaise,
    currency: 'INR',
    receipt: input.receipt,
    notes: input.notes,
  })
  return { id: json.id, amount: json.amount }
}

export async function cancelSubscriptionAtCycleEnd(subscriptionId: string): Promise<{ id: string; status: string }> {
  const json = await rzpFetch(`/subscriptions/${subscriptionId}/cancel`, { cancel_at_cycle_end: 1 })
  return { id: json.id, status: json.status }
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  return safeEqualHex(expected, signature)
}

export function verifyPaymentSignature(
  input: { orderId: string; paymentId: string; signature: string },
  secret: string,
): boolean {
  const expected = createHmac('sha256', secret).update(`${input.orderId}|${input.paymentId}`).digest('hex')
  return safeEqualHex(expected, input.signature)
}
