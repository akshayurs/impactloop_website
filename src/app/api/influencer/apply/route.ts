import { applyAsInfluencer } from '@/lib/server/influencer'
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
    await applyAsInfluencer(uid, Array.isArray(body.socialLinks) ? body.socialLinks : [], Date.now())
    return Response.json({ ok: true })
  } catch (err) {
    if (err instanceof Error) return Response.json({ error: err.message }, { status: 400 })
    console.error('apply failed', err)
    return Response.json({ error: 'apply failed' }, { status: 500 })
  }
}
