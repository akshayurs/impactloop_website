import { listUsers } from '@/lib/server/admin-data'
import { withAdmin } from '../_lib'

export const runtime = 'nodejs'

export async function GET(req: Request): Promise<Response> {
  return withAdmin(req, async () => {
    const params = new URL(req.url).searchParams
    const q = params.get('q')
    const cursor = params.get('cursor')
    const { users, nextCursor } = await listUsers(q ?? undefined, cursor ?? undefined)
    return Response.json({ users, nextCursor })
  })
}
