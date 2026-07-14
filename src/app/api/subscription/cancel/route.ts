import { adminDb } from '@/lib/server/firebase-admin'
import { cancelSubscriptionAtCycleEnd } from '@/lib/server/razorpay'
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
    if (typeof body.appId !== 'string') return Response.json({ error: 'appId required' }, { status: 400 })

    const ref = adminDb().doc(`users/${uid}/apps/${body.appId}`)
    const snap = await ref.get()
    const subId = snap.exists ? snap.data()?.subscription?.razorpaySubscriptionId : null
    if (!subId) return Response.json({ error: 'no cancellable subscription' }, { status: 400 })

    await cancelSubscriptionAtCycleEnd(subId)
    await ref.set({ subscription: { autoRenewing: false } }, { mergeFields: ['subscription.autoRenewing'] })
    return Response.json({ cancelled: true })
  } catch (err) {
    console.error('cancel failed', err)
    return Response.json({ error: 'cancel failed' }, { status: 500 })
  }
}
