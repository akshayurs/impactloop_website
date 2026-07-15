import { getSettings, updateSettings } from '@/lib/server/settings'
import { withAdmin } from '../_lib'

export const runtime = 'nodejs'

export async function GET(req: Request): Promise<Response> {
  return withAdmin(req, async () => Response.json(await getSettings()))
}

export async function PUT(req: Request): Promise<Response> {
  return withAdmin(req, async () => {
    const body = await req.json().catch(() => ({}))
    try {
      return Response.json(await updateSettings(body))
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : 'invalid settings' }, { status: 400 })
    }
  })
}
