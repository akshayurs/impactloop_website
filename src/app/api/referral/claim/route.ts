import { adminDb } from '@/lib/server/firebase-admin'
import { getInfluencer, recordReferral } from '@/lib/server/influencer'
import { isPromoUsable, normalizeCode, type PromoDoc } from '@/lib/server/promo'
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
    const body = await req.json().catch(() => ({}))
    if (typeof body.code !== 'string') return Response.json({ error: 'code required' }, { status: 400 })
    const code = normalizeCode(body.code)
    const now = Date.now()

    const promoSnap = await adminDb().doc(`promoCodes/${code}`).get()
    const promo = promoSnap.exists ? (promoSnap.data() as PromoDoc) : undefined
    const usable = isPromoUsable(promo, now)
    if (!usable.ok) return Response.json({ error: `code ${usable.reason}` }, { status: 400 })
    if (promo!.ownerUid === uid) return Response.json({ error: 'cannot use your own code' }, { status: 400 })

    const owner = await getInfluencer(promo!.ownerUid)
    if (!owner || owner.status !== 'approved') return Response.json({ error: 'code inactive' }, { status: 400 })

    const userSnap = await adminDb().doc(`users/${uid}`).get()
    if (userSnap.exists && userSnap.data()?.referredBy) {
      return Response.json({ claimed: false, reason: 'already-referred' })
    }

    await adminDb().doc(`users/${uid}`).set({ referredBy: code, referredAt: now }, { merge: true })
    await recordReferral({
      id: `signup-${uid}`,
      code,
      ownerUid: promo!.ownerUid,
      referredUid: uid,
      type: 'signup',
      planId: null,
      commissionPaise: owner.commissionRates.signupPaise,
      nowMillis: now,
    })
    return Response.json({ claimed: true })
  } catch (err) {
    console.error('referral claim failed', err)
    return Response.json({ error: 'claim failed' }, { status: 500 })
  }
}
