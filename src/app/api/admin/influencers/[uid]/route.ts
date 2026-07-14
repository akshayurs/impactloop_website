import { decideInfluencer, getEarnings, recordPayout, updateInfluencerRates } from '@/lib/server/influencer'
import { withAdmin } from '../../_lib'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: Promise<{ uid: string }> }): Promise<Response> {
  const { uid } = await params

  return withAdmin(req, async () => {
    const body = await req.json().catch(() => ({}))

    if (body.action === 'approve' || body.action === 'reject') {
      try {
        await decideInfluencer(uid, body.action, Date.now())
        return Response.json({ ok: true })
      } catch (err) {
        if (err instanceof Error) return Response.json({ error: err.message }, { status: 400 })
        throw err
      }
    }

    if (body.action === 'update-rates') {
      try {
        await updateInfluencerRates(uid, {
          discountPct: body.discountPct,
          signupPaise: body.signupPaise,
          perPlan: body.perPlan,
        })
        return Response.json({ ok: true })
      } catch (err) {
        if (err instanceof Error) return Response.json({ error: err.message }, { status: 400 })
        throw err
      }
    }

    if (body.action === 'mark-paid') {
      try {
        await recordPayout(uid, body.amountPaise, body.note, Date.now())
        return Response.json({ ok: true })
      } catch (err) {
        if (err instanceof Error) return Response.json({ error: err.message }, { status: 400 })
        throw err
      }
    }

    if (body.action === 'earnings') {
      try {
        const earnings = await getEarnings(uid)
        return Response.json(earnings)
      } catch (err) {
        console.error('earnings failed', err)
        return Response.json({ error: 'failed' }, { status: 500 })
      }
    }

    return Response.json({ error: 'unknown action' }, { status: 400 })
  })
}
