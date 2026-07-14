import { adminDb } from '@/lib/server/firebase-admin'
import { buildLifetimeEntitlement, writeEntitlement } from '@/lib/server/entitlements'
import { getPlanById } from '@/lib/server/plans-store'
import { verifyPaymentSignature } from '@/lib/server/razorpay'
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
    const { orderId, paymentId, signature } = body
    if (typeof orderId !== 'string' || typeof paymentId !== 'string' || typeof signature !== 'string') {
      return Response.json({ error: 'orderId, paymentId, signature required' }, { status: 400 })
    }

    const secret = process.env.RAZORPAY_KEY_SECRET
    if (!secret) throw new Error('RAZORPAY_KEY_SECRET env missing')
    if (!verifyPaymentSignature({ orderId, paymentId, signature }, secret)) {
      return Response.json({ error: 'invalid signature' }, { status: 400 })
    }

    const orderSnap = await adminDb().doc(`orders/${orderId}`).get()
    if (!orderSnap.exists) return Response.json({ error: 'unknown order' }, { status: 400 })
    const order = orderSnap.data()!
    if (order.uid !== uid) return Response.json({ error: 'forbidden' }, { status: 403 })
    if (order.status === 'paid') return Response.json({ granted: true })

    const plan = await getPlanById(order.planId)
    if (!plan?.lifetime) return Response.json({ error: 'not a lifetime order' }, { status: 400 })

    const now = Date.now()
    await writeEntitlement(uid, order.appId, buildLifetimeEntitlement({ plan, nowMillis: now }))
    await adminDb().doc(`orders/${orderId}`).set({ status: 'paid', paymentId, paidAt: now }, { merge: true })
    await adminDb().doc(`users/${uid}/payments/${paymentId}`).set(
      { amountPaise: order.amountPaise, planId: order.planId, appId: order.appId, type: 'lifetime', createdAt: now },
      { merge: true },
    )
    return Response.json({ granted: true })
  } catch (err) {
    console.error('checkout verify failed', err)
    return Response.json({ error: 'verification failed' }, { status: 500 })
  }
}
