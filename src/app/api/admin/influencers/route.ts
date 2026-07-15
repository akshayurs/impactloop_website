import { adminAuth, adminDb } from '@/lib/server/firebase-admin'
import { withAdmin } from '../_lib'

export const runtime = 'nodejs'

const PAGE_SIZE = 50

export async function GET(req: Request): Promise<Response> {
  return withAdmin(req, async () => {
    const cursor = new URL(req.url).searchParams.get('cursor')
    let query = adminDb().collection('influencers').orderBy('__name__').limit(PAGE_SIZE)
    if (cursor) query = query.startAfter(cursor)
    const snap = await query.get()
    const influencers: Array<{
      uid: string
      status: string
      socialLinks: string[]
      appliedAt: number
      promoCode: string | null
      discountPct: number
      commissionRates: Record<string, unknown>
      email: string | null
    }> = []

    for (const doc of snap.docs) {
      const data = doc.data() as any
      let email: string | null = null
      try {
        const user = await adminAuth().getUser(doc.id)
        email = user.email ?? null
      } catch {
        // user not found or error fetching
      }
      influencers.push({
        uid: doc.id,
        status: data.status,
        socialLinks: data.socialLinks ?? [],
        appliedAt: data.appliedAt,
        promoCode: data.promoCode ?? null,
        discountPct: data.discountPct,
        commissionRates: data.commissionRates,
        email,
      })
    }

    const last = snap.docs[snap.docs.length - 1]
    return Response.json({ influencers, nextCursor: snap.docs.length === PAGE_SIZE && last ? last.id : null })
  })
}
