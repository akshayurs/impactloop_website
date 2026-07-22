import { APPS } from '@/config/apps'
import { enroll } from '@/lib/server/influencer-apps'
import { appOnlySchema, parseBody } from '@/lib/server/validation'
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
    const { appId } = await parseBody(req, appOnlySchema)
    const app = APPS.find((a) => a.id === appId && a.status === 'live')
    if (!app) return Response.json({ error: 'unknown app' }, { status: 400 })
    await enroll(uid, app.id, Date.now())
    return Response.json({ ok: true })
  } catch (err) {
    if (err instanceof Error) return Response.json({ error: err.message }, { status: 400 })
    throw err
  }
}
