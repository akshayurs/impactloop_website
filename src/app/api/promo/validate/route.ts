import { adminDb } from '@/lib/server/firebase-admin'
import { getEnrollment } from '@/lib/server/influencer-apps'
import { getPartnerConfig } from '@/lib/server/partner-config'
import { isPromoUsable, normalizeCode, PROMO_CODE_RE, type PromoDoc } from '@/lib/server/promo'

export const runtime = 'nodejs'

// Short shared-edge cache keyed by ?code: collapses repeat lookups + brute scans
// off Firestore. Checkout re-validates server-side, so brief staleness is safe.
const CACHE = { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' }

export async function GET(req: Request): Promise<Response> {
  const raw = new URL(req.url).searchParams.get('code')
  if (!raw) return Response.json({ valid: false, reason: 'code required' }, { status: 400 })
  try {
    const code = normalizeCode(raw)
    if (!PROMO_CODE_RE.test(code)) return Response.json({ valid: false, reason: 'not-found' }, { headers: CACHE })
    const snap = await adminDb().doc(`promoCodes/${code}`).get()
    const promo = snap.exists ? (snap.data() as PromoDoc) : undefined
    const usable = isPromoUsable(promo, Date.now())
    if (!usable.ok) return Response.json({ valid: false, reason: usable.reason }, { headers: CACHE })
    // A code belongs to exactly one app; the discount is that app's default.
    const [enrollment, config] = await Promise.all([
      getEnrollment(promo!.ownerUid, promo!.appId),
      getPartnerConfig(promo!.appId),
    ])
    if (!enrollment || enrollment.status !== 'approved' || !config.enabled) {
      return Response.json({ valid: false, reason: 'inactive' }, { headers: CACHE })
    }
    return Response.json({ valid: true, appId: promo!.appId, discountPct: config.discountPct }, { headers: CACHE })
  } catch (err) {
    console.error('promo validate failed', err)
    return Response.json({ valid: false, reason: 'error' }, { status: 500 })
  }
}
