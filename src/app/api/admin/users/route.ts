import { listUsers } from '@/lib/server/admin-data'
import { withAdmin } from '../_lib'

export const runtime = 'nodejs'

export async function GET(req: Request): Promise<Response> {
  return withAdmin(req, async () => {
    const q = new URL(req.url).searchParams.get('q')
    return Response.json({ users: await listUsers(q ?? undefined) })
  })
}
