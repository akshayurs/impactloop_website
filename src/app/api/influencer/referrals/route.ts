import { listReferrals } from '@/lib/server/influencer'
import { hasApprovedEnrollment } from '@/lib/server/influencer-apps'
import { requireUser, UnauthorizedError } from '@/lib/server/verify-token'

export const runtime = 'nodejs'

export async function GET(req: Request): Promise<Response> {
  let uid: string
  try {
    ;({ uid } = await requireUser(req))
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'unauthorized' }, { status: 401 })
    throw err
  }
  try {
    if (!(await hasApprovedEnrollment(uid))) return Response.json({ error: 'forbidden' }, { status: 403 })
    const cursor = new URL(req.url).searchParams.get('cursor')
    const { referrals, nextCursor } = await listReferrals(uid, 20, cursor ?? undefined)
    return Response.json({ referrals, nextCursor })
  } catch (err) {
    console.error('referrals page failed', err)
    return Response.json({ error: 'failed' }, { status: 500 })
  }
}
