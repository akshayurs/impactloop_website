import { notifyCommission } from './email/notify'
import { adminDb } from './firebase-admin'
import { recordReferral } from './influencer'
import { getEnrollment } from './influencer-apps'

/**
 * Credit a partner's signup commission — but only once the referred user actually
 * pays. Claiming a code stores attribution only (see /api/referral/claim); the money
 * is credited here, on the referred user's first paid purchase. This gate is what
 * stops throwaway-account signup farming. Idempotent: the `signup-{uid}` referral is
 * created at most once, so repeat purchases never re-credit.
 */
export async function creditSignupCommission(referredUid: string, nowMillis: number): Promise<void> {
  const snap = await adminDb().doc(`users/${referredUid}`).get()
  const u = snap.exists ? (snap.data() ?? {}) : null
  const code: string | undefined = u?.referredBy
  if (!code) return

  let ownerUid: string | undefined = u?.referredByOwnerUid
  let appId: string | undefined = u?.referredByAppId
  if (!ownerUid || !appId) {
    // Attribution recorded before we stored owner/app — resolve from the promo doc.
    const promoSnap = await adminDb().doc(`promoCodes/${code}`).get()
    if (!promoSnap.exists) return
    const p = promoSnap.data() ?? {}
    ownerUid = p.ownerUid
    appId = p.appId
  }
  if (!ownerUid || !appId || ownerUid === referredUid) return

  const enrollment = await getEnrollment(ownerUid, appId)
  if (!enrollment || enrollment.status !== 'approved') return
  const signupPaise = enrollment.commissionRates?.signupPaise ?? 0
  if (signupPaise <= 0) return

  const created = await recordReferral({
    id: `signup-${referredUid}`,
    code,
    ownerUid,
    appId,
    referredUid,
    type: 'signup',
    planId: null,
    commissionPaise: signupPaise,
    nowMillis,
  })
  if (created) await notifyCommission({ ownerUid, planId: 'signup', commissionPaise: signupPaise })
}
