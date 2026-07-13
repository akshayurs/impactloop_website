// Server-only thin REST client for Razorpay. Uses raw `fetch` + HTTP Basic auth
// (not the `razorpay` npm SDK). Env vars are read inside each function, never at
// module scope, so `next build` (no real env) never throws.

function razorpayAuthHeader(): string {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  return 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64')
}

export type RazorpaySubscription = {
  id: string
  short_url: string
  status: string
}

export async function createSubscription(params: {
  planId: string
  notes: Record<string, string>
  totalCount?: number
}): Promise<RazorpaySubscription> {
  const res = await fetch('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: {
      Authorization: razorpayAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      plan_id: params.planId,
      total_count: params.totalCount ?? 120,
      customer_notify: 1,
      notes: params.notes,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Razorpay createSubscription failed (${res.status}): ${text}`)
  }

  return res.json()
}

export async function cancelSubscription(subId: string): Promise<void> {
  const res = await fetch(`https://api.razorpay.com/v1/subscriptions/${subId}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: razorpayAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ cancel_at_cycle_end: 1 }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Razorpay cancelSubscription failed (${res.status}): ${text}`)
  }
}
