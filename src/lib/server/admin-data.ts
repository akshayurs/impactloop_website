import type { StoredPlan } from '@/config/plans'
import { adminAuth, adminDb } from './firebase-admin'
import { createPlan } from './razorpay'

export async function getMetrics() {
  const db = adminDb()
  const [paymentsSnap, subsSnap, eventsSnap, usersResult] = await Promise.all([
    db.collectionGroup('payments').get(),
    db.collection('razorpaySubscriptions').get(),
    db.collection('webhookEvents').get(),
    adminAuth().listUsers(1000),
  ])
  let totalRevenuePaise = 0
  paymentsSnap.forEach((d: any) => {
    const amt = d.data().amountPaise
    if (Number.isInteger(amt)) totalRevenuePaise += amt
  })
  return {
    totalRevenuePaise,
    paymentCount: paymentsSnap.size,
    userCount: usersResult.users.length,
    activeSubscriptionCount: subsSnap.size,
    webhookEventCount: eventsSnap.size,
  }
}

export async function listUsers(q?: string) {
  const result = await adminAuth().listUsers(1000)
  const users = result.users.map((u) => ({
    uid: u.uid,
    email: u.email ?? null,
    displayName: u.displayName ?? null,
    admin: u.customClaims?.admin === true,
    createdAt: u.metadata.creationTime,
  }))
  if (!q) return users
  const needle = q.toLowerCase()
  return users.filter(
    (u) => u.email?.toLowerCase().includes(needle) || u.displayName?.toLowerCase().includes(needle) || u.uid === q,
  )
}

export async function getUserDetail(uid: string) {
  const db = adminDb()
  const [authUser, appsSnap, paymentsSnap] = await Promise.all([
    adminAuth()
      .getUser(uid)
      .catch(() => null),
    db.collection(`users/${uid}/apps`).get(),
    db.collection(`users/${uid}/payments`).orderBy('createdAt', 'desc').limit(20).get(),
  ])
  return {
    profile: authUser ? { uid: authUser.uid, email: authUser.email ?? null, displayName: authUser.displayName ?? null } : null,
    apps: appsSnap.docs.map((d: any) => ({ appId: d.id, data: d.data() })),
    payments: paymentsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
  }
}

export async function revokeEntitlement(uid: string, appId: string): Promise<void> {
  await adminDb()
    .doc(`users/${uid}/apps/${appId}`)
    .set(
      {
        subscription: { status: 'revoked', autoRenewing: false },
        entitlements: { adFree: false, unlimitedAi: false },
      },
      { merge: true },
    )
}

const PLAN_ID_RE = /^[a-z0-9-]{3,40}$/

export async function createPlanWithRazorpay(input: {
  id: string
  appId: string
  tier: 'pro' | 'ai'
  durationMonths: 1 | 3 | 6 | 12 | null
  lifetime: boolean
  pricePaise: number
  playStorePricePaise: number | null
  sort: number
}): Promise<StoredPlan> {
  if (!PLAN_ID_RE.test(input.id)) throw new Error('id must be a slug: [a-z0-9-]{3,40}')
  if (!Number.isInteger(input.pricePaise) || input.pricePaise <= 0) throw new Error('price must be positive integer paise')
  if (input.lifetime !== (input.durationMonths === null)) throw new Error('lifetime plans must have null duration (and vice versa)')

  const ref = adminDb().doc(`plans/${input.id}`)
  if ((await ref.get()).exists) throw new Error(`plan ${input.id} already exists`)

  const razorpayPlanId = input.lifetime
    ? null
    : (
        await createPlan({
          name: `${input.appId} ${input.tier} ${input.durationMonths}m`,
          amountPaise: input.pricePaise,
          intervalMonths: input.durationMonths!,
        })
      ).id

  const plan: StoredPlan = { ...input, razorpayPlanId, active: true }
  await ref.set(plan)
  return plan
}

const MUTABLE_PLAN_FIELDS = new Set(['playStorePricePaise', 'sort', 'active'])

export async function updatePlanFields(
  planId: string,
  patch: { playStorePricePaise?: number | null; sort?: number; active?: boolean },
): Promise<void> {
  for (const key of Object.keys(patch)) {
    if (!MUTABLE_PLAN_FIELDS.has(key)) throw new Error(`field ${key} is immutable or unknown`)
  }
  await adminDb().doc(`plans/${planId}`).set(patch, { merge: true })
}

export async function listWebhookEvents(limit = 50) {
  const snap = await adminDb().collection('webhookEvents').orderBy('receivedAt', 'desc').limit(limit).get()
  return snap.docs.map((d: any) => ({ id: d.id, event: d.data().event as string, receivedAt: d.data().receivedAt as number }))
}
