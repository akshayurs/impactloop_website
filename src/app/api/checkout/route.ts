import { adminDb } from '@/lib/server/firebase-admin'
import { getInfluencer } from '@/lib/server/influencer'
import { getPlanById } from '@/lib/server/plans-store'
import { discountedPaise, freeDaysFor, isPromoUsable, normalizeCode, type PromoDoc } from '@/lib/server/promo'
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

    let promo: { code: string; ownerUid: string; discountPct: number } | null = null
    if (body.promoCode !== undefined) {
      if (typeof body.promoCode !== 'string') return Response.json({ error: 'invalid promo code' }, { status: 400 })
      const code = normalizeCode(body.promoCode)
      const promoSnap = await adminDb().doc(`promoCodes/${code}`).get()
      const promoDoc = promoSnap.exists ? (promoSnap.data() as PromoDoc) : undefined
      const usable = isPromoUsable(promoDoc, Date.now())
      if (!usable.ok) return Response.json({ error: `promo ${usable.reason}` }, { status: 400 })
      if (promoDoc!.ownerUid === uid) return Response.json({ error: 'cannot use your own code' }, { status: 400 })
      const owner = await getInfluencer(promoDoc!.ownerUid)
      if (!owner || owner.status !== 'approved') return Response.json({ error: 'promo inactive' }, { status: 400 })
      promo = { code, ownerUid: promoDoc!.ownerUid, discountPct: owner.discountPct }
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
      const amountPaise = promo ? discountedPaise(plan.pricePaise, promo.discountPct) : plan.pricePaise
      const order = await createOrder({
        amountPaise,
        receipt: `${uid}-${plan.id}`.slice(0, 40),
        notes: {
          uid, appId: plan.appId, planId: plan.id,
          ...(promo ? { promoCode: promo.code, promoOwnerUid: promo.ownerUid, discountPct: String(promo.discountPct) } : {}),
        },
      })
      await adminDb().doc(`orders/${order.id}`).set({
        uid, appId: plan.appId, planId: plan.id, amountPaise, status: 'created', createdAt: Date.now(),
        ...(promo ? { promoCode: promo.code, promoOwnerUid: promo.ownerUid } : {}),
      })
      return Response.json({
        mode: 'order',
        orderId: order.id,
        amountPaise: order.amount,
        keyId,
        ...(promo ? { promo: { code: promo.code, discountPct: promo.discountPct, freeDays: 0 } } : {}),
      })
    }

    if (!plan.razorpayPlanId) return Response.json({ error: 'plan not available for checkout' }, { status: 400 })
    const totalCount = Math.ceil(120 / (plan.durationMonths ?? 1))
    const freeDays = promo ? freeDaysFor(plan.durationMonths ?? 1, promo.discountPct) : 0
    const startAtUnix = promo && freeDays > 0 ? Math.floor((Date.now() + freeDays * 86_400_000) / 1000) : undefined
    const sub = await createSubscription({
      razorpayPlanId: plan.razorpayPlanId,
      totalCount,
      notes: {
        uid, appId: plan.appId, planId: plan.id,
        ...(promo ? { promoCode: promo.code, promoOwnerUid: promo.ownerUid, discountPct: String(promo.discountPct) } : {}),
      },
      ...(startAtUnix ? { startAtUnix } : {}),
    })
    await adminDb().doc(`razorpaySubscriptions/${sub.id}`).set({
      uid, appId: plan.appId, planId: plan.id, createdAt: Date.now(),
      ...(promo ? { promoCode: promo.code, promoOwnerUid: promo.ownerUid } : {}),
    })
    return Response.json({
      mode: 'subscription',
      subscriptionId: sub.id,
      keyId,
      ...(promo ? { promo: { code: promo.code, discountPct: promo.discountPct, freeDays } } : {}),
    })
  } catch (err) {
    console.error('checkout failed', err)
    return Response.json({ error: 'checkout failed' }, { status: 500 })
  }
}
