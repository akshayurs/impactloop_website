import { DEFAULT_APP_ID } from '@/config/apps'
import { adminAuth, adminDb } from '@/lib/server/firebase-admin'
import { listAppEnrollments, type EnrollmentStatus } from '@/lib/server/influencer-apps'
import { getPartnerConfig } from '@/lib/server/partner-config'
import { withAdmin } from '../_lib'

export const runtime = 'nodejs'

export async function GET(req: Request): Promise<Response> {
  return withAdmin(req, async () => {
    const params = new URL(req.url).searchParams
    const cursor = params.get('cursor')
    const statusParam = params.get('status')
    const appId = params.get('appId') ?? DEFAULT_APP_ID
    const status =
      statusParam && ['pending', 'approved', 'rejected'].includes(statusParam)
        ? (statusParam as EnrollmentStatus)
        : undefined

    const [{ enrollments, nextCursor }, config] = await Promise.all([
      listAppEnrollments(appId, { status, cursor }),
      getPartnerConfig(appId),
    ])

    const influencers = await Promise.all(
      enrollments.map(async (e) => {
        let email: string | null = null
        let socialLinks: string[] = []
        try {
          email = (await adminAuth().getUser(e.uid)).email ?? null
        } catch {
          // user not found or error fetching
        }
        try {
          const id = await adminDb().doc(`influencers/${e.uid}`).get()
          socialLinks = (id.data()?.socialLinks as string[]) ?? []
        } catch {
          // identity not found
        }
        return {
          uid: e.uid,
          appId: e.appId,
          status: e.status,
          socialLinks,
          appliedAt: e.appliedAt,
          promoCode: e.promoCode,
          discountPct: config.discountPct,
          commissionRates: e.commissionRates,
          email,
        }
      }),
    )

    return Response.json({ influencers, nextCursor })
  })
}
