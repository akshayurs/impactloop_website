import { DEFAULT_APP_ID } from '@/config/apps'
import { getPartnerConfig, updatePartnerConfig } from '@/lib/server/partner-config'
import { withAdmin } from '../_lib'

export const runtime = 'nodejs'

export async function GET(req: Request): Promise<Response> {
  return withAdmin(req, async () => {
    const appId = new URL(req.url).searchParams.get('appId') ?? DEFAULT_APP_ID
    return Response.json({ appId, config: await getPartnerConfig(appId) })
  })
}

export async function PUT(req: Request): Promise<Response> {
  return withAdmin(req, async () => {
    const body = await req.json().catch(() => ({}))
    const appId = typeof body.appId === 'string' ? body.appId : DEFAULT_APP_ID
    try {
      const config = await updatePartnerConfig(appId, { discountPct: body.discountPct, enabled: body.enabled })
      return Response.json({ appId, config })
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : 'invalid config' }, { status: 400 })
    }
  })
}
