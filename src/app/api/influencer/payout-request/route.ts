import { notifyPayoutRequest } from '@/lib/server/email/notify'
import { requestPayout } from '@/lib/server/influencer'
import { hasApprovedEnrollment } from '@/lib/server/influencer-apps'
import { getSettings } from '@/lib/server/settings'
import { parseBody, payoutRequestSchema } from '@/lib/server/validation'
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
    const { upiId } = await parseBody(req, payoutRequestSchema)
    if (!(await hasApprovedEnrollment(uid))) {
      return Response.json({ error: 'approved influencers only' }, { status: 403 })
    }
    const { minPayoutPaise } = await getSettings()
    const request = await requestPayout(uid, minPayoutPaise, upiId, Date.now())
    await notifyPayoutRequest({ uid, amountPaise: request.amountPaise, upiId: request.upiId })
    return Response.json({ ok: true, request })
  } catch (err) {
    if (err instanceof Error) return Response.json({ error: err.message }, { status: 400 })
    throw err
  }
}
