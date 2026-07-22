import { AggregateField } from 'firebase-admin/firestore'
import { adminDb } from './firebase-admin'
import { pageCursor, parsePageCursor } from './influencer'
import { expiryFromNow, normalizeCode, PROMO_CODE_RE } from './promo'

export type EnrollmentStatus = 'pending' | 'approved' | 'rejected'

/** A partner's enrollment into one app. Doc id is `${uid}_${appId}`. */
export type Enrollment = {
  uid: string
  appId: string
  status: EnrollmentStatus
  appliedAt: number
  decidedAt: number | null
  promoCode: string | null
  commissionRates: { signupPaise: number; perPlan: Record<string, number> }
}

function docId(uid: string, appId: string): string {
  return `${uid}_${appId}`
}

export async function getEnrollment(uid: string, appId: string): Promise<Enrollment | null> {
  const snap = await adminDb().doc(`influencerApps/${docId(uid, appId)}`).get()
  return snap.exists ? (snap.data() as Enrollment) : null
}

export async function listEnrollments(uid: string): Promise<Enrollment[]> {
  const snap = await adminDb().collection('influencerApps').where('uid', '==', uid).get()
  return snap.docs.map((d) => d.data() as Enrollment)
}

export async function hasApprovedEnrollment(uid: string): Promise<boolean> {
  const snap = await adminDb()
    .collection('influencerApps')
    .where('uid', '==', uid)
    .where('status', '==', 'approved')
    .limit(1)
    .get()
  return !snap.empty
}

/** Opt into an app. Requires the shared identity to already exist (partner applied). */
export async function enroll(uid: string, appId: string, nowMillis: number): Promise<void> {
  const identity = await adminDb().doc(`influencers/${uid}`).get()
  if (!identity.exists) throw new Error('join the partner program first')
  const ref = adminDb().doc(`influencerApps/${docId(uid, appId)}`)
  const status = (await ref.get()).data()?.status as EnrollmentStatus | undefined
  if (status === 'pending' || status === 'approved') throw new Error('already enrolled for this app')
  const doc: Enrollment = {
    uid,
    appId,
    status: 'pending',
    appliedAt: nowMillis,
    decidedAt: null,
    promoCode: null,
    commissionRates: { signupPaise: 0, perPlan: {} },
  }
  await ref.set(doc)
}

export async function decideEnrollment(
  uid: string,
  appId: string,
  decision: 'approved' | 'rejected',
  nowMillis: number,
): Promise<void> {
  const ref = adminDb().doc(`influencerApps/${docId(uid, appId)}`)
  const snap = await ref.get()
  if (!snap.exists || (snap.data() as Enrollment).status !== 'pending') {
    throw new Error('only pending enrollments can be decided')
  }
  await ref.set({ status: decision, decidedAt: nowMillis }, { merge: true })
}

export async function updateAppCommission(
  uid: string,
  appId: string,
  rates: { signupPaise?: number; perPlan?: Record<string, number> },
): Promise<void> {
  const patch: Record<string, unknown> = {}
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
  const ref = adminDb().doc(`influencerApps/${docId(uid, appId)}`)
  if (!(await ref.get()).exists) throw new Error('enrollment not found')
  await ref.set(patch, { merge: true })
}

/** Assign/replace this partner's promo code for one app. Codes are globally unique. */
export async function changeAppPromoCode(
  uid: string,
  appId: string,
  rawCode: string,
  nowMillis: number,
  expiryMonths: number,
): Promise<{ code: string; expiresAt: number }> {
  const code = normalizeCode(rawCode)
  if (!PROMO_CODE_RE.test(code)) throw new Error('code must be 4-16 letters/numbers')
  const enrollment = await getEnrollment(uid, appId)
  if (!enrollment || enrollment.status !== 'approved') throw new Error('approved enrollment required')
  const db = adminDb()
  const expiresAt = expiryFromNow(nowMillis, expiryMonths)
  // Atomic swap: claim the new code, release the old, and point the enrollment at it in
  // one transaction — no window where the code is taken-but-unassigned or vice versa.
  await db.runTransaction(async (tx) => {
    const newRef = db.doc(`promoCodes/${code}`)
    if ((await tx.get(newRef)).exists) throw new Error('code already taken')
    if (enrollment.promoCode) tx.delete(db.doc(`promoCodes/${enrollment.promoCode}`))
    tx.set(newRef, { code, ownerUid: uid, appId, active: true, createdAt: nowMillis, expiresAt })
    tx.set(db.doc(`influencerApps/${docId(uid, appId)}`), { promoCode: code }, { merge: true })
  })
  return { code, expiresAt }
}

const ADMIN_PAGE = 50

/** Admin listing of enrollments for one app, newest first, optional status filter. */
export async function listAppEnrollments(
  appId: string,
  opts?: { status?: EnrollmentStatus; limit?: number; cursor?: string | null },
): Promise<{ enrollments: Enrollment[]; nextCursor: string | null }> {
  const limit = opts?.limit ?? ADMIN_PAGE
  let query = adminDb().collection('influencerApps').where('appId', '==', appId)
  if (opts?.status) query = query.where('status', '==', opts.status)
  query = query.orderBy('appliedAt', 'desc').orderBy('__name__', 'desc').limit(limit)
  const after = parsePageCursor(opts?.cursor ?? null)
  if (after) query = query.startAfter(after.value, after.id)
  const snap = await query.get()
  return {
    enrollments: snap.docs.map((d) => d.data() as Enrollment),
    nextCursor: pageCursor(snap.docs, 'appliedAt', limit),
  }
}

function trunc(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0
}

/** Per-app commission earned (for the portal's per-app breakdown; balance/payouts stay aggregate). */
export async function getAppCommission(uid: string, appId: string): Promise<number> {
  const agg = await adminDb()
    .collection('referrals')
    .where('ownerUid', '==', uid)
    .where('appId', '==', appId)
    .aggregate({ total: AggregateField.sum('commissionPaise') })
    .get()
  return trunc(agg.data().total)
}
