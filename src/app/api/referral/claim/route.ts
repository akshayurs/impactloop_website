import { adminDb } from '@/lib/server/firebase-admin'
import { getEnrollment } from '@/lib/server/influencer-apps'
import { isPromoUsable, type PromoDoc } from '@/lib/server/promo'
import { parseBody, referralClaimSchema, ValidationError } from '@/lib/server/validation'
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
    const { code } = await parseBody(req, referralClaimSchema)
    const now = Date.now()

    const promoSnap = await adminDb().doc(`promoCodes/${code}`).get()
    const promo = promoSnap.exists ? (promoSnap.data() as PromoDoc) : undefined
    const usable = isPromoUsable(promo, now)
    if (!usable.ok) return Response.json({ error: `code ${usable.reason}` }, { status: 400 })
    if (promo!.ownerUid === uid) return Response.json({ error: 'cannot use your own code' }, { status: 400 })

    const enrollment = await getEnrollment(promo!.ownerUid, promo!.appId)
    if (!enrollment || enrollment.status !== 'approved') return Response.json({ error: 'code inactive' }, { status: 400 })

    const userSnap = await adminDb().doc(`users/${uid}`).get()
    if (userSnap.exists && userSnap.data()?.referredBy) {
      return Response.json({ claimed: false, reason: 'already-referred' })
    }

    // Record attribution only. Signup commission (if configured) is credited later,
    // on the referred user's first paid purchase — see creditSignupCommission.
    await adminDb().doc(`users/${uid}`).set(
      { referredBy: code, referredByOwnerUid: promo!.ownerUid, referredByAppId: promo!.appId, referredAt: now },
      { merge: true },
    )
    return Response.json({ claimed: true })
  } catch (err) {
    if (err instanceof ValidationError) return Response.json({ error: err.message }, { status: 400 })
    console.error('referral claim failed', err)
    return Response.json({ error: 'claim failed' }, { status: 500 })
  }
}
