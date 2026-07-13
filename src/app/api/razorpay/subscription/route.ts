import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { verifyIdToken, UnauthorizedError } from '@/lib/verify-id-token'
import { adminDb } from '@/lib/firebase-admin'
import { getApp } from '@/config/apps'
import { createSubscription } from '@/lib/razorpay'
import { parseSubscriptionBody } from '@/lib/subscription-request'
import { isLiveSubscription } from '@/lib/entitlement'

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

  const body = parseSubscriptionBody(await req.json().catch(() => null))
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { appId, tier } = body

  const app = getApp(appId)
  if (!app) {
    return NextResponse.json({ error: 'Unknown app' }, { status: 400 })
  }

  const planId = app.razorpayPlanIds[tier]
  if (!planId) {
    return NextResponse.json({ error: 'Plan not configured for this app/tier' }, { status: 400 })
  }

  try {
    const existing = await adminDb().doc(`users/${uid}/apps/${appId}`).get()
    if (isLiveSubscription(existing.data()?.subscription)) {
      return NextResponse.json({ error: 'already-subscribed' }, { status: 409 })
    }

    const sub = await createSubscription({ planId, notes: { uid, appId, tier } })

    await adminDb().doc(`razorpaySubscriptions/${sub.id}`).set({
      uid,
      appId,
      tier,
      createdAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({
      subscriptionId: sub.id,
      keyId: process.env.RAZORPAY_KEY_ID,
    })
  } catch (err) {
    console.error('razorpay/subscription: failed to create subscription', err)
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
  }
}
