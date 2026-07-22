import { DEFAULT_APP_ID } from '@/config/apps'
import { changeAppPromoCode } from '@/lib/server/influencer-apps'
import { getSettings } from '@/lib/server/settings'
import { changePromoSchema, parseBody } from '@/lib/server/validation'
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
    const { appId, code } = await parseBody(req, changePromoSchema)
    const settings = await getSettings()
    const result = await changeAppPromoCode(uid, appId ?? DEFAULT_APP_ID, code, Date.now(), settings.promoDefaultExpiryMonths)
    return Response.json(result)
  } catch (err) {
    if (err instanceof Error) return Response.json({ error: err.message }, { status: 400 })
    console.error('promo code change failed', err)
    return Response.json({ error: 'failed' }, { status: 500 })
  }
}
