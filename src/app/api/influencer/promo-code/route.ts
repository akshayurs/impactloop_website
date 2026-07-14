import { changePromoCode } from '@/lib/server/influencer'
import { getSettings } from '@/lib/server/settings'
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
    const settings = await getSettings()
    const result = await changePromoCode(uid, body.code, Date.now(), settings.promoDefaultExpiryMonths)
    return Response.json(result)
  } catch (err) {
    if (err instanceof Error) return Response.json({ error: err.message }, { status: 400 })
    console.error('promo code change failed', err)
    return Response.json({ error: 'failed' }, { status: 500 })
  }
}
