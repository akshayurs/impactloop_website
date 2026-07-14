import { updatePlanFields } from '@/lib/server/admin-data'
import { withAdmin } from '../../_lib'

export const runtime = 'nodejs'

export async function PATCH(req: Request, ctx: { params: Promise<{ planId: string }> }): Promise<Response> {
  return withAdmin(req, async () => {
    const { planId } = await ctx.params
    const body = await req.json().catch(() => ({}))
    try {
      await updatePlanFields(planId, body)
      return Response.json({ ok: true })
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : 'invalid patch' }, { status: 400 })
    }
  })
}
