import { adminDb } from '@/lib/server/firebase-admin'
import { getPlanById } from '@/lib/server/plans-store'
import { createOrder, createSubscription } from '@/lib/server/razorpay'
import { isLiveStatus } from '@/lib/server/entitlements'
import { requireUser, UnauthorizedError } from '@/lib/server/verify-token'

export const runtime = 'nodejs'

export async function POST(req: Request): Promise<Response> {
  let uid: string
  try {
    ;({ uid } = await requireUser(req))
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'unauthorized' }, { status: 401 })
    throw err
  }

  try {
    const body = await req.json().catch(() => ({}))
    if (typeof body.planId !== 'string') return Response.json({ error: 'planId required' }, { status: 400 })
    if (body.promoCode !== undefined) {
      return Response.json({ error: 'promo codes not yet supported' }, { status: 400 })
    }

    const plan = await getPlanById(body.planId)
    if (!plan || !plan.active) return Response.json({ error: 'unknown plan' }, { status: 400 })

    const existing = await adminDb().doc(`users/${uid}/apps/${plan.appId}`).get()
    const status = existing.exists ? existing.data()?.subscription?.status : undefined
    if (typeof status === 'string' && (isLiveStatus(status) || status === 'lifetime')) {
      return Response.json({ error: 'subscription already active' }, { status: 409 })
    }

    const keyId = process.env.RAZORPAY_KEY_ID
    if (!keyId) throw new Error('RAZORPAY_KEY_ID env missing')

    if (plan.lifetime) {
      const order = await createOrder({
        amountPaise: plan.pricePaise,
        receipt: `${uid}-${plan.id}`.slice(0, 40),
        notes: { uid, appId: plan.appId, planId: plan.id },
      })
      await adminDb().doc(`orders/${order.id}`).set({
        uid, appId: plan.appId, planId: plan.id, amountPaise: plan.pricePaise, status: 'created', createdAt: Date.now(),
      })
      return Response.json({ mode: 'order', orderId: order.id, amountPaise: order.amount, keyId })
    }

    if (!plan.razorpayPlanId) return Response.json({ error: 'plan not available for checkout' }, { status: 400 })
    const totalCount = Math.ceil(120 / (plan.durationMonths ?? 1))
    const sub = await createSubscription({
      razorpayPlanId: plan.razorpayPlanId,
      totalCount,
      notes: { uid, appId: plan.appId, planId: plan.id },
    })
    await adminDb().doc(`razorpaySubscriptions/${sub.id}`).set({
      uid, appId: plan.appId, planId: plan.id, createdAt: Date.now(),
    })
    return Response.json({ mode: 'subscription', subscriptionId: sub.id, keyId })
  } catch (err) {
    console.error('checkout failed', err)
    return Response.json({ error: 'checkout failed' }, { status: 500 })
  }
}
