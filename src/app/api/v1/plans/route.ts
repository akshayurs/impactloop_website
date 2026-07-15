import { getApp } from '@/config/apps'
import { getPlansFromDb } from '@/lib/server/plans-store'

export const runtime = 'nodejs'

export async function GET(req: Request): Promise<Response> {
  const app = new URL(req.url).searchParams.get('app')
  if (!app || !getApp(app)) return Response.json({ error: 'unknown app' }, { status: 400 })

  const plans = await getPlansFromDb(app)
  const publicPlans = plans.map((p) => ({
    id: p.id,
    tier: p.tier,
    durationMonths: p.durationMonths,
    lifetime: p.lifetime,
    pricePaise: p.pricePaise,
  }))
  return Response.json({ plans: publicPlans }, { headers: { 'Cache-Control': 'public, max-age=300' } })
}
