import { getApp } from '@/config/apps'
import { getUserDetail, revokeEntitlement } from '@/lib/server/admin-data'
import { getSettings } from '@/lib/server/settings'
import { grantTrial } from '@/lib/server/trial'
import { withAdmin } from '../../_lib'

export const runtime = 'nodejs'

export async function GET(req: Request, ctx: { params: Promise<{ uid: string }> }): Promise<Response> {
  return withAdmin(req, async () => {
    const { uid } = await ctx.params
    return Response.json(await getUserDetail(uid))
  })
}

export async function POST(req: Request, ctx: { params: Promise<{ uid: string }> }): Promise<Response> {
  return withAdmin(req, async () => {
    const { uid } = await ctx.params
    const body = await req.json().catch(() => ({}))
    if (typeof body.appId !== 'string' || !getApp(body.appId)) {
      return Response.json({ error: 'unknown app' }, { status: 400 })
    }
    if (body.action === 'grant-trial') {
      const days = body.trialDays ?? (await getSettings()).trialDays
      if (!Number.isInteger(days) || days < 1 || days > 365) return Response.json({ error: 'invalid trialDays' }, { status: 400 })
      await grantTrial(uid, body.appId, days, Date.now())
      return Response.json({ ok: true })
    }
    if (body.action === 'revoke') {
      await revokeEntitlement(uid, body.appId)
      return Response.json({ ok: true })
    }
    return Response.json({ error: 'unknown action' }, { status: 400 })
  })
}
