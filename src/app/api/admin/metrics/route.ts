import { getMetrics } from '@/lib/server/admin-data'
import { withAdmin } from '../_lib'

export const runtime = 'nodejs'

export async function GET(req: Request): Promise<Response> {
  return withAdmin(req, async () => Response.json(await getMetrics()))
}
