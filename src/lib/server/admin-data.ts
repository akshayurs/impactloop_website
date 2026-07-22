import { revalidateTag, unstable_cache } from 'next/cache'
import { AggregateField } from 'firebase-admin/firestore'
import type { StoredPlan } from '@/config/plans'
import { adminAuth, adminDb } from './firebase-admin'
import { PLANS_CACHE_TAG } from './plans-store'
import { cancelSubscriptionAtCycleEnd, createPlan } from './razorpay'

const DAY_MS = 86_400_000

export const METRICS_CACHE_TAG = 'admin-metrics'

/** All Firebase Auth users, paginated (listUsers caps at 1000 per page). */
async function listAllAuthUsers() {
  const out: Awaited<ReturnType<ReturnType<typeof adminAuth>['listUsers']>>['users'] = []
  let pageToken: string | undefined
  do {
    const page = await adminAuth().listUsers(1000, pageToken)
    out.push(...page.users)
    pageToken = page.pageToken
  } while (pageToken)
  return out
}

/* Reads several growing collections; wrapped in a short-lived cache (below) so the
   admin overview can be loaded repeatedly without re-scanning on every request. */
async function computeMetrics() {
  const db = adminDb()
  const now = Date.now()
  const [paymentsSnap, eventsSnap, allUsers, appsSnap, infSnap] = await Promise.all([
    db.collectionGroup('payments').get(),
    db.collection('webhookEvents').get(),
    listAllAuthUsers(),
    db.collectionGroup('apps').get(),
    db.collection('influencerApps').get(),
  ])

  let totalRevenuePaise = 0
  let revenue30dPaise = 0
  let revenue7dPaise = 0
  const recentPayments: Array<{ id: string; amountPaise: number; planId: string | null; appId: string | null; type: string | null; createdAt: number }> = []
  paymentsSnap.forEach((d: any) => {
    const data = d.data()
    const amt = data.amountPaise
    if (!Number.isInteger(amt)) return
    totalRevenuePaise += amt
    const at = typeof data.createdAt === 'number' ? data.createdAt : 0
    if (at > now - 30 * DAY_MS) revenue30dPaise += amt
    if (at > now - 7 * DAY_MS) revenue7dPaise += amt
    recentPayments.push({ id: d.id, amountPaise: amt, planId: data.planId ?? null, appId: data.appId ?? null, type: data.type ?? null, createdAt: at })
  })
  recentPayments.sort((a, b) => b.createdAt - a.createdAt)

  const newUsers7d = allUsers.filter((u) => {
    const t = Date.parse(u.metadata.creationTime ?? '')
    return Number.isFinite(t) && t > now - 7 * DAY_MS
  }).length

  const subsByStatus: Record<string, number> = {}
  const subsByTier: Record<string, number> = {}
  appsSnap.forEach((d: any) => {
    const sub = d.data().subscription
    if (!sub?.status) return
    subsByStatus[sub.status] = (subsByStatus[sub.status] ?? 0) + 1
    if (sub.tier && (sub.status === 'active' || sub.status === 'lifetime')) {
      subsByTier[sub.tier] = (subsByTier[sub.tier] ?? 0) + 1
    }
  })

  // Counts per-app enrollment status (a partner in N apps counts once per app).
  const influencersByStatus: Record<string, number> = {}
  infSnap.forEach((d: any) => {
    const status = d.data().status ?? 'unknown'
    influencersByStatus[status] = (influencersByStatus[status] ?? 0) + 1
  })

  let lastWebhookAt = 0
  eventsSnap.forEach((d: any) => {
    const at = d.data().receivedAt
    if (typeof at === 'number' && at > lastWebhookAt) lastWebhookAt = at
  })

  const [commAgg, paidAgg] = await Promise.all([
    db.collection('referrals').aggregate({ total: AggregateField.sum('commissionPaise') }).get(),
    db.collection('payouts').aggregate({ total: AggregateField.sum('amountPaise') }).get(),
  ])
  const commissionPaise = Math.trunc(commAgg.data().total ?? 0)
  const paidOutPaise = Math.trunc(paidAgg.data().total ?? 0)

  return {
    totalRevenuePaise,
    revenue30dPaise,
    revenue7dPaise,
    paymentCount: paymentsSnap.size,
    recentPayments: recentPayments.slice(0, 5),
    userCount: allUsers.length,
    newUsers7d,
    subsByStatus,
    subsByTier,
    influencersByStatus,
    commissionPaise,
    paidOutPaise,
    owedPaise: commissionPaise - paidOutPaise,
    webhookEventCount: eventsSnap.size,
    lastWebhookAt: lastWebhookAt || null,
  }
}

/* Short cache so repeated admin-overview loads don't re-scan payments/entitlements
   every request. Invalidate via revalidateTag(METRICS_CACHE_TAG) on a payment write
   for near-real-time revenue, or accept up to ~60s staleness. */
export const getMetrics = unstable_cache(computeMetrics, ['admin-metrics'], {
  revalidate: 60,
  tags: [METRICS_CACHE_TAG],
})

export type UserPlanSummary = { appId: string; status: string; tier: string | null }

/* Joins each user's entitlement docs (one batched getAll per page) so the admin
   list can show and filter by plan status without opening every user. */
async function attachPlans<T extends { uid: string }>(users: T[]): Promise<Array<T & { plans: UserPlanSummary[] }>> {
  if (users.length === 0) return []
  const { APPS } = await import('@/config/apps')
  const db = adminDb()
  const refs = users.flatMap((u) => APPS.map((a) => db.doc(`users/${u.uid}/apps/${a.id}`)))
  const snaps = await db.getAll(...refs)
  const byUid = new Map<string, UserPlanSummary[]>()
  snaps.forEach((snap, i) => {
    const user = users[Math.floor(i / APPS.length)]
    const appId = APPS[i % APPS.length].id
    const sub = snap.exists ? (snap.data() as any).subscription : null
    if (!sub) return
    const list = byUid.get(user.uid) ?? []
    list.push({ appId, status: sub.status ?? 'unknown', tier: sub.tier ?? null })
    byUid.set(user.uid, list)
  })
  return users.map((u) => ({ ...u, plans: byUid.get(u.uid) ?? [] }))
}

export async function listUsers(q?: string, cursor?: string, limit = 50) {
  // Search scans a large page client-side (Admin SDK has no server-side search); no cursor then.
  const result = q ? await adminAuth().listUsers(1000) : await adminAuth().listUsers(limit, cursor)
  const users = result.users.map((u) => ({
    uid: u.uid,
    email: u.email ?? null,
    displayName: u.displayName ?? null,
    admin: u.customClaims?.admin === true,
    createdAt: u.metadata.creationTime,
  }))
  if (!q) return { users: await attachPlans(users), nextCursor: result.pageToken ?? null }
  const needle = q.toLowerCase()
  const matched = users.filter(
    (u) => u.email?.toLowerCase().includes(needle) || u.displayName?.toLowerCase().includes(needle) || u.uid === q,
  )
  return { users: await attachPlans(matched.slice(0, 100)), nextCursor: null }
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
  const ref = adminDb().doc(`users/${uid}/apps/${appId}`)
  const snap = await ref.get()
  const subId = snap.data()?.subscription?.razorpaySubscriptionId
  if (subId) {
    // Stop future charges too — otherwise a revoked user keeps getting billed.
    try {
      await cancelSubscriptionAtCycleEnd(subId)
    } catch (err) {
      console.error('revoke: razorpay cancel failed', err)
    }
  }
  await ref.set(
    {
      subscription: { status: 'revoked', autoRenewing: false, expiryTimeMillis: null },
      entitlements: { adFree: false, unlimitedAi: false, tier: null },
    },
    { merge: true },
  )
}

const PLAN_ID_RE = /^[a-z0-9-]{3,40}$/

export async function createPlanWithRazorpay(input: {
  id: string
  appId: string
  tier: string
  durationMonths: 1 | 3 | 6 | 12 | null
  lifetime: boolean
  pricePaise: number
  playStorePricePaise: number | null
  sort: number
}): Promise<StoredPlan> {
  if (!PLAN_ID_RE.test(input.id)) throw new Error('id must be a slug: [a-z0-9-]{3,40}')
  if (!/^[a-z0-9-]{2,20}$/.test(input.tier)) throw new Error('tier must be a slug (a-z, 0-9, dashes)')
  if (![1, 3, 6, 12, null].includes(input.durationMonths)) throw new Error('durationMonths must be 1, 3, 6, 12, or null')
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

  const plan: StoredPlan = {
    id: input.id,
    appId: input.appId,
    tier: input.tier,
    durationMonths: input.durationMonths,
    lifetime: input.lifetime,
    pricePaise: input.pricePaise,
    playStorePricePaise: input.playStorePricePaise,
    sort: input.sort,
    razorpayPlanId,
    active: true,
  }
  await ref.set(plan)
  revalidateTag(PLANS_CACHE_TAG)
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
  revalidateTag(PLANS_CACHE_TAG)
}

/* Cursor format shared by paginated Firestore lists: "<orderValue>_<docId>". */
export function parseCursor(cursor: string | undefined | null): { value: number; id: string } | null {
  if (!cursor) return null
  const sep = cursor.indexOf('_')
  if (sep < 1) return null
  const value = Number(cursor.slice(0, sep))
  const id = cursor.slice(sep + 1)
  return Number.isFinite(value) && id ? { value, id } : null
}

export async function listWebhookEvents(limit = 50, cursor?: string) {
  let query = adminDb()
    .collection('webhookEvents')
    .orderBy('receivedAt', 'desc')
    .orderBy('__name__', 'desc')
    .limit(limit)
  const after = parseCursor(cursor)
  if (after) query = query.startAfter(after.value, after.id)
  const snap = await query.get()
  const events = snap.docs.map((d: any) => ({ id: d.id, event: d.data().event as string, receivedAt: d.data().receivedAt as number }))
  const last = snap.docs[snap.docs.length - 1]
  return { events, nextCursor: snap.docs.length === limit && last ? `${last.data().receivedAt}_${last.id}` : null }
}
