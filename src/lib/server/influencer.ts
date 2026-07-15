import { AggregateField } from 'firebase-admin/firestore'
import { adminDb } from './firebase-admin'
import { expiryFromNow, normalizeCode, PROMO_CODE_RE } from './promo'

function trunc(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0
}

export type InfluencerDoc = {
  status: 'pending' | 'approved' | 'rejected'
  socialLinks: string[]
  appliedAt: number
  decidedAt: number | null
  discountPct: number
  commissionRates: { signupPaise: number; perPlan: Record<string, number> }
  promoCode: string | null
}

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export async function applyAsInfluencer(uid: string, socialLinks: string[], nowMillis: number): Promise<void> {
  if (!Array.isArray(socialLinks) || socialLinks.length < 1 || socialLinks.length > 5 || !socialLinks.every(isHttpUrl)) {
    throw new Error('provide 1-5 valid social links (http/https URLs)')
  }
  const snap = await adminDb().doc(`influencers/${uid}`).get()
  const status = snap.exists ? (snap.data() as InfluencerDoc).status : null
  if (status === 'pending' || status === 'approved') throw new Error('application already exists')
  const doc: InfluencerDoc = {
    status: 'pending',
    socialLinks,
    appliedAt: nowMillis,
    decidedAt: null,
    discountPct: 10,
    commissionRates: { signupPaise: 0, perPlan: {} },
    promoCode: null,
  }
  await adminDb().doc(`influencers/${uid}`).set(doc)
}

export async function getInfluencer(uid: string): Promise<InfluencerDoc | null> {
  const snap = await adminDb().doc(`influencers/${uid}`).get()
  return snap.exists ? (snap.data() as InfluencerDoc) : null
}

export async function decideInfluencer(uid: string, decision: 'approved' | 'rejected', nowMillis: number): Promise<void> {
  const snap = await adminDb().doc(`influencers/${uid}`).get()
  if (!snap.exists || (snap.data() as InfluencerDoc).status !== 'pending') {
    throw new Error('only pending applications can be decided')
  }
  await adminDb().doc(`influencers/${uid}`).set({ status: decision, decidedAt: nowMillis }, { merge: true })
}

export async function updateInfluencerRates(
  uid: string,
  rates: { discountPct?: number; signupPaise?: number; perPlan?: Record<string, number> },
): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (rates.discountPct !== undefined) {
    if (!Number.isInteger(rates.discountPct) || rates.discountPct < 0 || rates.discountPct > 90) {
      throw new Error('discountPct must be integer 0-90')
    }
    patch.discountPct = rates.discountPct
  }
  if (rates.signupPaise !== undefined) {
    if (!Number.isInteger(rates.signupPaise) || rates.signupPaise < 0) throw new Error('signupPaise must be non-negative integer')
    patch['commissionRates.signupPaise'] = rates.signupPaise
  }
  if (rates.perPlan !== undefined) {
    for (const [planId, paise] of Object.entries(rates.perPlan)) {
      if (!Number.isInteger(paise) || paise < 0) throw new Error(`perPlan.${planId} must be non-negative integer`)
    }
    patch['commissionRates.perPlan'] = rates.perPlan
  }
  if (Object.keys(patch).length === 0) throw new Error('empty rates patch')
  await adminDb().doc(`influencers/${uid}`).set(patch, { merge: true })
}

export async function changePromoCode(
  uid: string,
  rawCode: string,
  nowMillis: number,
  expiryMonths: number,
): Promise<{ code: string; expiresAt: number }> {
  const code = normalizeCode(rawCode)
  if (!PROMO_CODE_RE.test(code)) throw new Error('code must be 4-16 letters/numbers')
  const inf = await getInfluencer(uid)
  if (!inf || inf.status !== 'approved') throw new Error('approved influencers only')
  const existing = await adminDb().doc(`promoCodes/${code}`).get()
  if (existing.exists) throw new Error('code already taken')
  if (inf.promoCode) await adminDb().doc(`promoCodes/${inf.promoCode}`).delete()
  const expiresAt = expiryFromNow(nowMillis, expiryMonths)
  await adminDb().doc(`promoCodes/${code}`).set({ code, ownerUid: uid, active: true, createdAt: nowMillis, expiresAt })
  await adminDb().doc(`influencers/${uid}`).set({ promoCode: code }, { merge: true })
  return { code, expiresAt }
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
  referredUid: string
  type: 'signup' | 'subscription' | 'lifetime'
  planId: string | null
  commissionPaise: number
  nowMillis: number
}): Promise<void> {
  const ref = adminDb().doc(`referrals/${input.id}`)
  if ((await ref.get()).exists) return
  await ref.set({
    code: input.code,
    ownerUid: input.ownerUid,
    referredUid: input.referredUid,
    type: input.type,
    planId: input.planId,
    commissionPaise: input.commissionPaise,
    createdAt: input.nowMillis,
  })
}

const EARNINGS_PAGE = 20

function pageCursor(docs: FirebaseFirestore.QueryDocumentSnapshot[], field: string, limit: number): string | null {
  const last = docs[docs.length - 1]
  return docs.length === limit && last ? `${last.data()[field]}_${last.id}` : null
}

function parsePageCursor(cursor: string | undefined | null): { value: number; id: string } | null {
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

export async function getEarnings(uid: string) {
  const db = adminDb()
  const referralsQuery = db.collection('referrals').where('ownerUid', '==', uid)
  const payoutsQuery = db.collection('payouts').where('influencerUid', '==', uid)
  const [commAgg, paidAgg, refPage, payPage] = await Promise.all([
    referralsQuery.aggregate({ total: AggregateField.sum('commissionPaise') }).get(),
    payoutsQuery.aggregate({ total: AggregateField.sum('amountPaise') }).get(),
    listReferrals(uid),
    listPayouts(uid),
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
    tx.set(db.doc(`payouts/${influencerUid}-${nowMillis}`), { influencerUid, amountPaise, note, paidAt: nowMillis })
  })
}
