import { NextResponse } from 'next/server'
import { verifyIdToken, UnauthorizedError } from '@/lib/verify-id-token'
import { adminDb } from '@/lib/firebase-admin'
import { cancelSubscription } from '@/lib/razorpay'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  let uid: string
  try {
    ;({ uid } = await verifyIdToken(req))
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    throw err
  }

  const body = await req.json().catch(() => null)
  const appId = body && typeof body === 'object' ? (body as Record<string, unknown>).appId : undefined
  if (typeof appId !== 'string' || appId.length === 0) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // subId is read from the caller's own entitlement doc (uid from the verified token),
  // never accepted from the request body — a client cannot cancel another user's subscription.
  const snap = await adminDb().doc(`users/${uid}/apps/${appId}`).get()
  const subId = snap.exists ? (snap.data()?.subscription?.razorpaySubscriptionId as string | undefined) : undefined

  if (!subId) {
    return NextResponse.json({ error: 'No active subscription' }, { status: 400 })
  }

  try {
    await cancelSubscription(subId)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 })
  }
}
