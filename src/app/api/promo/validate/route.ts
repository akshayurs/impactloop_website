import { adminDb } from '@/lib/server/firebase-admin'
import { getInfluencer } from '@/lib/server/influencer'
import { isPromoUsable, normalizeCode, type PromoDoc } from '@/lib/server/promo'

export const runtime = 'nodejs'

// Short shared-edge cache keyed by ?code: collapses repeat lookups + brute scans
// off Firestore. Checkout re-validates server-side, so brief staleness is safe.
const CACHE = { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' }

export async function GET(req: Request): Promise<Response> {
  const raw = new URL(req.url).searchParams.get('code')
  if (!raw) return Response.json({ valid: false, reason: 'code required' }, { status: 400 })
  try {
    const code = normalizeCode(raw)
    const snap = await adminDb().doc(`promoCodes/${code}`).get()
    const promo = snap.exists ? (snap.data() as PromoDoc) : undefined
    const usable = isPromoUsable(promo, Date.now())
    if (!usable.ok) return Response.json({ valid: false, reason: usable.reason }, { headers: CACHE })
    const owner = await getInfluencer(promo!.ownerUid)
    if (!owner || owner.status !== 'approved') {
      return Response.json({ valid: false, reason: 'inactive' }, { headers: CACHE })
    }
    return Response.json({ valid: true, discountPct: owner.discountPct }, { headers: CACHE })
  } catch (err) {
    console.error('promo validate failed', err)
    return Response.json({ valid: false, reason: 'error' }, { status: 500 })
  }
}
