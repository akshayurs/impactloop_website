import { getEarnings, getInfluencer, suggestCodes } from '@/lib/server/influencer'
import { requireUser, UnauthorizedError } from '@/lib/server/verify-token'

export const runtime = 'nodejs'

export async function GET(req: Request): Promise<Response> {
  let uid: string, email: string | null
  try {
    ;({ uid, email } = await requireUser(req))
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'unauthorized' }, { status: 401 })
    throw err
  }
  try {
    const influencer = await getInfluencer(uid)
    if (!influencer) return Response.json({ influencer: null, suggestions: [], earnings: null })
    const approved = influencer.status === 'approved'
    const suggestions = approved && !influencer.promoCode ? suggestCodes(email?.split('@')[0] ?? null, uid) : []
    const earnings = approved ? await getEarnings(uid) : null
    return Response.json({ influencer, suggestions, earnings })
  } catch (err) {
    console.error('influencer me failed', err)
    return Response.json({ error: 'failed' }, { status: 500 })
  }
}
