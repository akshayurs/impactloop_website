import * as Sentry from '@sentry/nextjs'
import { adminDb } from '@/lib/server/firebase-admin'
import { creditSignupCommission } from '@/lib/server/commission'
import {
  buildLifetimeEntitlement,
  buildSubscriptionEntitlement,
  clearEntitlement,
  writeEntitlement,
} from '@/lib/server/entitlements'
import { notifyCommission, notifyPurchase } from '@/lib/server/email/notify'
import { recordReferral, reverseReferral } from '@/lib/server/influencer'
import { getEnrollment } from '@/lib/server/influencer-apps'
import { getPlanById } from '@/lib/server/plans-store'
import { commissionForPlan } from '@/lib/server/promo'
import { verifyWebhookSignature } from '@/lib/server/razorpay'
import { idempotencyKeyFor, mapWebhookEvent } from '@/lib/server/webhook-events'

export const runtime = 'nodejs'

async function maybeRecordCommission(params: {
  promoCode?: string | null
  promoOwnerUid?: string | null
  appId: string
  planId: string
  referredUid: string
  referralId: string
  type: 'subscription' | 'lifetime'
  nowMillis: number
}): Promise<void> {
  const { promoCode, promoOwnerUid, appId, planId, referredUid, referralId, type, nowMillis } = params
  if (!promoCode || !promoOwnerUid) return
  if (promoOwnerUid === referredUid) return
  const enrollment = await getEnrollment(promoOwnerUid, appId)
  if (!enrollment || enrollment.status !== 'approved') {
    console.warn('webhook: promo owner missing/not approved, skipping commission', { promoOwnerUid, appId, referralId })
    return
  }
  const commissionPaise = commissionForPlan(enrollment.commissionRates, planId)
  if (commissionPaise <= 0) return
  const created = await recordReferral({
    id: referralId,
    code: promoCode,
    ownerUid: promoOwnerUid,
    appId,
    referredUid,
    type,
    planId,
    commissionPaise,
    nowMillis,
  })
  if (created) await notifyCommission({ ownerUid: promoOwnerUid, planId, commissionPaise })
}

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) {
    console.error('webhook: RAZORPAY_WEBHOOK_SECRET missing')
    return Response.json({ error: 'webhook not configured' }, { status: 500 })
  }

  const raw = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''
  if (!verifyWebhookSignature(raw, signature, secret)) {
    return Response.json({ error: 'invalid signature' }, { status: 400 })
  }

  try {
    const body = JSON.parse(raw)
    const key = idempotencyKeyFor(body, req.headers.get('x-razorpay-event-id'))
    const markerRef = adminDb().doc(`webhookEvents/${key}`)
    if ((await markerRef.get()).exists) return Response.json({ duplicate: true })

    const effect = mapWebhookEvent(body)
    const now = Date.now()

    if (effect.kind === 'subscription-update') {
      const idx = await adminDb().doc(`razorpaySubscriptions/${effect.subscriptionId}`).get()
      const notes = body?.payload?.subscription?.entity?.notes
      const ctx = idx.exists
        ? idx.data()
        : notes?.uid
          ? { uid: notes.uid, appId: notes.appId, planId: notes.planId, promoCode: notes.promoCode, promoOwnerUid: notes.promoOwnerUid }
          : null
      if (!ctx?.uid || !ctx.appId || !ctx.planId) {
        console.error('webhook: unresolvable subscription context', effect.subscriptionId)
        return Response.json({ ok: false, reason: 'unknown subscription' })
      }
      const plan = await getPlanById(ctx.planId)
      if (!plan) {
        console.error('webhook: unknown plan', ctx.planId)
        return Response.json({ ok: false, reason: 'unknown plan' })
      }

      const existingEntitlementSnap = await adminDb().doc(`users/${ctx.uid}/apps/${ctx.appId}`).get()
      const existingLifetimeStatus = existingEntitlementSnap.data()?.subscription?.status
      if (existingLifetimeStatus === 'lifetime') {
        console.warn('webhook: skipping subscription update over lifetime grant', { subscriptionId: effect.subscriptionId, uid: ctx.uid, appId: ctx.appId })
      } else {
        await writeEntitlement(
          ctx.uid,
          ctx.appId,
          buildSubscriptionEntitlement({
            plan,
            status: effect.status,
            currentEndMillis: effect.currentEndMillis,
            razorpaySubscriptionId: effect.subscriptionId,
            nowMillis: now,
          }),
        )
      }
      if (effect.paymentId && effect.amountPaise !== null) {
        await adminDb().doc(`users/${ctx.uid}/payments/${effect.paymentId}`).set(
          { amountPaise: effect.amountPaise, planId: ctx.planId, appId: ctx.appId, type: 'subscription', createdAt: now },
          { merge: true },
        )
        await notifyPurchase({ uid: ctx.uid, appId: ctx.appId, planId: ctx.planId })
      }
      if (effect.paymentId) {
        await maybeRecordCommission({
          promoCode: ctx.promoCode,
          promoOwnerUid: ctx.promoOwnerUid,
          appId: ctx.appId,
          planId: ctx.planId,
          referredUid: ctx.uid,
          referralId: `sub-${effect.subscriptionId}`,
          type: 'subscription',
          nowMillis: now,
        })
        await creditSignupCommission(ctx.uid, now)
      }
    } else if (effect.kind === 'order-paid') {
      const orderSnap = await adminDb().doc(`orders/${effect.orderId}`).get()
      const order = orderSnap.exists ? orderSnap.data() : null
      if (order && order.status !== 'paid') {
        const plan = await getPlanById(order.planId)
        if (plan?.lifetime) {
          await writeEntitlement(order.uid, order.appId, buildLifetimeEntitlement({ plan, nowMillis: now }))
          await adminDb().doc(`orders/${effect.orderId}`).set({ status: 'paid', paymentId: effect.paymentId, paidAt: now }, { merge: true })
          await adminDb().doc(`users/${order.uid}/payments/${effect.paymentId}`).set(
            { amountPaise: effect.amountPaise, planId: order.planId, appId: order.appId, type: 'lifetime', createdAt: now },
            { merge: true },
          )
          await notifyPurchase({ uid: order.uid, appId: order.appId, planId: order.planId })
          await maybeRecordCommission({
            promoCode: order.promoCode,
            promoOwnerUid: order.promoOwnerUid,
            appId: order.appId,
            planId: order.planId,
            referredUid: order.uid,
            referralId: `lifetime-${order.uid}-${order.appId}`,
            type: 'lifetime',
            nowMillis: now,
          })
          await creditSignupCommission(order.uid, now)
        }
      }
    } else if (effect.kind === 'refund') {
      // Refund/chargeback: pull access and void the commission tied to this payment.
      // Handles the lifetime/order path fully; subscription-charge refunds are logged
      // for manual reconciliation (no order doc to resolve payment -> uid/app).
      const orderQuery = await adminDb().collection('orders').where('paymentId', '==', effect.paymentId).limit(1).get()
      const orderDoc = orderQuery.docs[0]
      if (orderDoc) {
        const o = orderDoc.data()
        await clearEntitlement(o.uid, o.appId, 'refunded')
        await reverseReferral(`lifetime-${o.uid}-${o.appId}`, now)
        await orderDoc.ref.set({ status: 'refunded', refundedAt: now }, { merge: true })
      } else {
        console.warn('webhook: refund for a payment with no lifetime order; manual reconciliation needed', {
          paymentId: effect.paymentId,
        })
      }
    }

    await markerRef.set({ event: body?.event ?? 'unknown', receivedAt: now }, { merge: true })
    return Response.json({ ok: true })
  } catch (err) {
    console.error('webhook processing failed', err)
    Sentry.captureException(err, { tags: { area: 'razorpay-webhook' } })
    return Response.json({ error: 'processing failed' }, { status: 500 })
  }
}
