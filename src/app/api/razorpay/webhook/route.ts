import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { verifyWebhookSignature } from '@/lib/razorpay-signature'
import { mapSubscriptionEvent } from '@/lib/razorpay-events'
import { resolveSubscriptionContext } from '@/lib/razorpay-webhook-context'
import { writeEntitlement } from '@/lib/entitlement'
import { adminDb } from '@/lib/firebase-admin'
import type { Tier } from '@/lib/subscription-request'

export const runtime = 'nodejs'

const PRODUCT_ID_FOR_TIER: Record<Tier, string> = {
  pro: 'pro_monthly',
  ai: 'ai_monthly',
}

type SubscriptionEntity = {
  id: string
  status?: string
  current_end?: number | null
  notes?: unknown
}

export async function POST(req: Request) {
  // Raw body only — signature is computed over the exact bytes Razorpay sent.
  const raw = await req.text()

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) {
    // Misconfiguration. Never fall back to "unverified" — fail closed.
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const signature = req.headers.get('x-razorpay-signature') ?? ''
  if (!verifyWebhookSignature(raw, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let body: { event?: string; payload?: { subscription?: { entity?: SubscriptionEntity } } }
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const effect = mapSubscriptionEvent(body.event ?? '')
  if (effect === null) {
    // Unhandled event type — ack so Razorpay doesn't retry it forever.
    return NextResponse.json({ ignored: true })
  }

  const sub = body.payload?.subscription?.entity
  if (!sub || typeof sub.id !== 'string' || sub.id.length === 0) {
    return NextResponse.json({ ignored: true })
  }

  const eventId = req.headers.get('x-razorpay-event-id')
  const idempotencyKey = eventId ?? `${sub.id}:${body.event}:${sub.current_end ?? ''}`
  const db = adminDb()
  const eventDocRef = db.doc(`webhookEvents/${idempotencyKey}`)

  try {
    const eventDoc = await eventDocRef.get()
    if (eventDoc.exists) {
      return NextResponse.json({ duplicate: true })
    }

    let context = resolveSubscriptionContext(sub.notes, null)
    if (!context) {
      const indexDoc = await db.doc(`razorpaySubscriptions/${sub.id}`).get()
      context = resolveSubscriptionContext(sub.notes, indexDoc.exists ? indexDoc.data() : null)
    }

    if (!context) {
      // Can't act without uid/appId. Ack to avoid a retry storm, but this is a
      // real anomaly (checkout index doc missing/incomplete) — worth alerting on.
      return NextResponse.json({ unresolved: true })
    }

    const productId = PRODUCT_ID_FOR_TIER[context.tier]

    // Write the entitlement BEFORE the idempotency marker. If the write throws,
    // no marker is left behind, so Razorpay's retry re-enters this handler and
    // tries again — the marker only lands once the grant has actually applied.
    await writeEntitlement(context.uid, context.appId, {
      productId,
      status: sub.status ?? (effect.active ? 'active' : 'cancelled'),
      expiryTimeMillis: sub.current_end ? sub.current_end * 1000 : 0,
      autoRenewing: effect.active,
      subscriptionId: sub.id,
      active: effect.active,
    })

    await eventDocRef.set({
      event: body.event,
      subscriptionId: sub.id,
      receivedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    // Transient failure (e.g. Firestore) — 500 makes Razorpay retry, which is
    // safe here since the idempotency marker is only written after a successful
    // entitlement write.
    console.error('razorpay/webhook: failed to process event', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
