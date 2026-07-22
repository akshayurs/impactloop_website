import { AggregateField } from 'firebase-admin/firestore'
import { adminDb } from './firebase-admin'

function trunc(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0
}

/** Program identity, shared across every app the partner enrolls in. */
export type InfluencerDoc = {
  socialLinks: string[]
  appliedAt: number
}

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** Create or update the shared partner identity. App enrollment happens separately. */
export async function applyAsInfluencer(uid: string, socialLinks: string[], nowMillis: number): Promise<void> {
  if (!Array.isArray(socialLinks) || socialLinks.length < 1 || socialLinks.length > 5 || !socialLinks.every(isHttpUrl)) {
    throw new Error('provide 1-5 valid social links (http/https URLs)')
  }
  const ref = adminDb().doc(`influencers/${uid}`)
  const snap = await ref.get()
  const appliedAt = snap.exists ? ((snap.data() as InfluencerDoc).appliedAt ?? nowMillis) : nowMillis
  await ref.set({ socialLinks, appliedAt }, { merge: true })
}

export async function getInfluencer(uid: string): Promise<InfluencerDoc | null> {
  const snap = await adminDb().doc(`influencers/${uid}`).get()
  return snap.exists ? (snap.data() as InfluencerDoc) : null
}

export function suggestCodes(displayName: string | null, uid: string): string[] {
  const base = (displayName ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8)
  const fallback = uid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8)
  const stem = (base.length >= 4 ? base : (base + fallback + 'LOOP')).slice(0, 8).padEnd(4, 'X')
  return [`${stem}10`, `${stem}25`, `${stem}VIP`].map((c) => c.slice(0, 16))
}

export async function recordReferral(input: {
  id: string
  code: string
  ownerUid: string
  appId: string
  referredUid: string
  type: 'signup' | 'subscription' | 'lifetime'
  planId: string | null
  commissionPaise: number
  nowMillis: number
}): Promise<boolean> {
  const ref = adminDb().doc(`referrals/${input.id}`)
  // Atomic create: two concurrent deliveries of the same event can't both credit.
  try {
    await ref.create({
      code: input.code,
      ownerUid: input.ownerUid,
      appId: input.appId,
      referredUid: input.referredUid,
      type: input.type,
      planId: input.planId,
      commissionPaise: input.commissionPaise,
      createdAt: input.nowMillis,
    })
    return true
  } catch (err) {
    if ((err as { code?: number })?.code === 6) return false // Firestore ALREADY_EXISTS
    throw err
  }
}

/** Void a referral's commission after a refund/chargeback. The aggregate balance
    (SUM of commissionPaise) then excludes it; the record is kept for audit. */
export async function reverseReferral(referralId: string, nowMillis: number): Promise<boolean> {
  const ref = adminDb().doc(`referrals/${referralId}`)
  const snap = await ref.get()
  if (!snap.exists) return false
  const data = snap.data() ?? {}
  if (data.reversed === true) return false
  await ref.set(
    {
      reversed: true,
      reversedAt: nowMillis,
      originalCommissionPaise: typeof data.commissionPaise === 'number' ? data.commissionPaise : 0,
      commissionPaise: 0,
    },
    { merge: true },
  )
  return true
}

const EARNINGS_PAGE = 20

export function pageCursor(docs: FirebaseFirestore.QueryDocumentSnapshot[], field: string, limit: number): string | null {
  const last = docs[docs.length - 1]
  return docs.length === limit && last ? `${last.data()[field]}_${last.id}` : null
}

export function parsePageCursor(cursor: string | undefined | null): { value: number; id: string } | null {
  if (!cursor) return null
  const sep = cursor.indexOf('_')
  if (sep < 1) return null
  const value = Number(cursor.slice(0, sep))
  const id = cursor.slice(sep + 1)
  return Number.isFinite(value) && id ? { value, id } : null
}

export async function listReferrals(uid: string, limit = EARNINGS_PAGE, cursor?: string) {
  let query = adminDb()
    .collection('referrals')
    .where('ownerUid', '==', uid)
    .orderBy('createdAt', 'desc')
    .orderBy('__name__', 'desc')
    .limit(limit)
  const after = parsePageCursor(cursor)
  if (after) query = query.startAfter(after.value, after.id)
  const snap = await query.get()
  return {
    referrals: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    nextCursor: pageCursor(snap.docs, 'createdAt', limit),
  }
}

export async function listPayouts(uid: string, limit = EARNINGS_PAGE, cursor?: string) {
  let query = adminDb()
    .collection('payouts')
    .where('influencerUid', '==', uid)
    .orderBy('paidAt', 'desc')
    .orderBy('__name__', 'desc')
    .limit(limit)
  const after = parsePageCursor(cursor)
  if (after) query = query.startAfter(after.value, after.id)
  const snap = await query.get()
  return {
    payouts: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    nextCursor: pageCursor(snap.docs, 'paidAt', limit),
  }
}

export type PayoutRequest = { amountPaise: number; requestedAt: number; upiId: string }

const UPI_ID_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/

export function normalizeUpiId(raw: unknown): string {
  const upiId = typeof raw === 'string' ? raw.trim() : ''
  if (!UPI_ID_RE.test(upiId)) throw new Error('enter a valid UPI ID (e.g. name@bank)')
  return upiId
}

function pendingRequest(data: FirebaseFirestore.DocumentData | undefined): PayoutRequest | null {
  if (!data || data.status !== 'pending') return null
  return { amountPaise: trunc(data.amountPaise), requestedAt: trunc(data.requestedAt), upiId: String(data.upiId ?? '') }
}

export async function getPayoutRequest(uid: string): Promise<PayoutRequest | null> {
  const snap = await adminDb().doc(`payoutRequests/${uid}`).get()
  return snap.exists ? pendingRequest(snap.data()) : null
}

/** Admin declines a pending payout request without paying it (kept for the audit trail). */
export async function declinePayoutRequest(uid: string, nowMillis: number): Promise<void> {
  const ref = adminDb().doc(`payoutRequests/${uid}`)
  const snap = await ref.get()
  if (!snap.exists || snap.data()?.status !== 'pending') throw new Error('no pending payout request')
  await ref.set({ status: 'rejected', decidedAt: nowMillis }, { merge: true })
}

export async function requestPayout(uid: string, minPayoutPaise: number, upiId: string, nowMillis: number): Promise<PayoutRequest> {
  const db = adminDb()
  // One transaction: re-check for an open request and recompute the balance against the
  // live ledger before writing, so two concurrent requests can't both open.
  return db.runTransaction(async (tx) => {
    const reqRef = db.doc(`payoutRequests/${uid}`)
    const existing = await tx.get(reqRef)
    if (existing.exists && existing.data()?.status === 'pending') throw new Error('payout already requested')
    const commQuery = db.collection('referrals').where('ownerUid', '==', uid).aggregate({ total: AggregateField.sum('commissionPaise') })
    const paidQuery = db.collection('payouts').where('influencerUid', '==', uid).aggregate({ total: AggregateField.sum('amountPaise') })
    const [commAgg, paidAgg] = await Promise.all([tx.get(commQuery), tx.get(paidQuery)])
    const balancePaise = trunc(commAgg.data().total) - trunc(paidAgg.data().total)
    if (balancePaise <= 0) throw new Error('no balance available to withdraw')
    if (balancePaise < minPayoutPaise) throw new Error(`minimum payout is ${minPayoutPaise} paise`)
    tx.set(reqRef, { influencerUid: uid, amountPaise: balancePaise, status: 'pending', requestedAt: nowMillis, upiId })
    return { amountPaise: balancePaise, requestedAt: nowMillis, upiId }
  })
}

export async function getEarnings(uid: string) {
  const db = adminDb()
  const referralsQuery = db.collection('referrals').where('ownerUid', '==', uid)
  const payoutsQuery = db.collection('payouts').where('influencerUid', '==', uid)
  const [commAgg, paidAgg, refPage, payPage, reqSnap] = await Promise.all([
    referralsQuery.aggregate({ total: AggregateField.sum('commissionPaise') }).get(),
    payoutsQuery.aggregate({ total: AggregateField.sum('amountPaise') }).get(),
    listReferrals(uid),
    listPayouts(uid),
    db.doc(`payoutRequests/${uid}`).get(),
  ])
  const totalCommissionPaise = trunc(commAgg.data().total)
  const paidPaise = trunc(paidAgg.data().total)
  return {
    totalCommissionPaise,
    paidPaise,
    balancePaise: totalCommissionPaise - paidPaise,
    referrals: refPage.referrals,
    referralsCursor: refPage.nextCursor,
    payouts: payPage.payouts,
    payoutsCursor: payPage.nextCursor,
    payoutRequest: reqSnap.exists ? pendingRequest(reqSnap.data()) : null,
  }
}

export async function recordPayout(influencerUid: string, amountPaise: number, note: string, nowMillis: number): Promise<void> {
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) throw new Error('amountPaise must be positive integer')
  const db = adminDb()
  await db.runTransaction(async (tx) => {
    const commQuery = db.collection('referrals').where('ownerUid', '==', influencerUid).aggregate({ total: AggregateField.sum('commissionPaise') })
    const paidQuery = db.collection('payouts').where('influencerUid', '==', influencerUid).aggregate({ total: AggregateField.sum('amountPaise') })
    const [commAgg, paidAgg] = await Promise.all([tx.get(commQuery), tx.get(paidQuery)])
    const balancePaise = trunc(commAgg.data().total) - trunc(paidAgg.data().total)
    if (amountPaise > balancePaise) throw new Error(`amount exceeds balance (${balancePaise})`)
    // Snapshot the ledger this payout settled against, for reconciliation/audit.
    tx.set(db.doc(`payouts/${influencerUid}-${nowMillis}`), {
      influencerUid,
      amountPaise,
      note,
      paidAt: nowMillis,
      balanceBeforePaise: balancePaise,
      commissionTotalPaise: trunc(commAgg.data().total),
    })
    // Clear any pending request in the same transaction — no window where a payout is
    // recorded but the request lingers (which invited a double-pay).
    tx.delete(db.doc(`payoutRequests/${influencerUid}`))
  })
}
