import { createPlanWithRazorpay } from '@/lib/server/admin-data'
import { adminDb } from '@/lib/server/firebase-admin'
import { withAdmin } from '../_lib'

export const runtime = 'nodejs'

export async function GET(req: Request): Promise<Response> {
  return withAdmin(req, async () => {
    const snap = await adminDb().collection('plans').orderBy('sort').get()
    return Response.json({ plans: snap.docs.map((d) => d.data()) })
  })
}

export async function POST(req: Request): Promise<Response> {
  return withAdmin(req, async () => {
    const body = await req.json().catch(() => ({}))
    try {
      return Response.json({ plan: await createPlanWithRazorpay(body) })
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : 'invalid plan' }, { status: 400 })
    }
  })
}
