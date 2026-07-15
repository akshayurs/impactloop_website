import { listWebhookEvents } from '@/lib/server/admin-data'
import { withAdmin } from '../_lib'

export const runtime = 'nodejs'

export async function GET(req: Request): Promise<Response> {
  return withAdmin(req, async () => {
    const cursor = new URL(req.url).searchParams.get('cursor')
    const { events, nextCursor } = await listWebhookEvents(50, cursor ?? undefined)
    return Response.json({ events, nextCursor })
  })
}
