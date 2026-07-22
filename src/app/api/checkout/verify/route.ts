import * as Sentry from '@sentry/nextjs'
import { adminDb } from '@/lib/server/firebase-admin'
import { creditSignupCommission } from '@/lib/server/commission'
import { buildLifetimeEntitlement, writeEntitlement } from '@/lib/server/entitlements'
import { notifyCommission, notifyPurchase } from '@/lib/server/email/notify'
import { recordReferral } from '@/lib/server/influencer'
import { getEnrollment } from '@/lib/server/influencer-apps'
import { getPlanById } from '@/lib/server/plans-store'
import { commissionForPlan } from '@/lib/server/promo'
import { verifyPaymentSignature } from '@/lib/server/razorpay'
import { parseBody, ValidationError, verifySchema } from '@/lib/server/validation'
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
    const { orderId, paymentId, signature } = await parseBody(req, verifySchema)

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
    await notifyPurchase({ uid, appId: order.appId, planId: order.planId })
    if (order.promoCode && order.promoOwnerUid) {
      const enrollment = await getEnrollment(order.promoOwnerUid, order.appId)
      if (!enrollment || enrollment.status !== 'approved') {
        console.warn('checkout verify: promo owner missing/not approved, skipping commission', { promoOwnerUid: order.promoOwnerUid, paymentId })
      } else {
        const commissionPaise = commissionForPlan(enrollment.commissionRates, order.planId)
        if (commissionPaise > 0) {
          // Keyed per user+app (not per payment) so a duplicate order can't double-credit.
          const created = await recordReferral({
            id: `lifetime-${uid}-${order.appId}`,
            code: order.promoCode,
            ownerUid: order.promoOwnerUid,
            appId: order.appId,
            referredUid: uid,
            type: 'lifetime',
            planId: order.planId,
            commissionPaise,
            nowMillis: now,
          })
          if (created) await notifyCommission({ ownerUid: order.promoOwnerUid, planId: order.planId, commissionPaise })
        }
      }
    }
    await creditSignupCommission(uid, now)
    return Response.json({ granted: true })
  } catch (err) {
    if (err instanceof ValidationError) return Response.json({ error: err.message }, { status: 400 })
    console.error('checkout verify failed', err)
    Sentry.captureException(err, { tags: { area: 'checkout-verify' } })
    return Response.json({ error: 'verification failed' }, { status: 500 })
  }
}
