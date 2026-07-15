import { revalidatePath } from 'next/cache'
import { listAllTiers, upsertTier } from '@/lib/server/tiers-store'
import { withAdmin } from '../_lib'

export const runtime = 'nodejs'

export async function GET(req: Request): Promise<Response> {
  return withAdmin(req, async () => Response.json({ tiers: await listAllTiers() }))
}

export async function PUT(req: Request): Promise<Response> {
  return withAdmin(req, async () => {
    const body = await req.json().catch(() => ({}))
    try {
      const tier = await upsertTier(body)
      revalidatePath('/pricing')
      return Response.json({ tier })
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : 'invalid tier' }, { status: 400 })
    }
  })
}
