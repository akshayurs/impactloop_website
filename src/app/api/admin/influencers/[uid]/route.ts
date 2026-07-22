import { DEFAULT_APP_ID } from '@/config/apps'
import { notifyInfluencerDecision, notifyPayoutRequest } from '@/lib/server/email/notify'
import { declinePayoutRequest, getEarnings, normalizeUpiId, recordPayout, requestPayout } from '@/lib/server/influencer'
import { changeAppPromoCode, decideEnrollment, getEnrollment, updateAppCommission } from '@/lib/server/influencer-apps'
import { getSettings } from '@/lib/server/settings'
import { withAdmin } from '../../_lib'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: Promise<{ uid: string }> }): Promise<Response> {
  const { uid } = await params

  return withAdmin(req, async () => {
    const body = await req.json().catch(() => ({}))
    const appId = typeof body.appId === 'string' ? body.appId : DEFAULT_APP_ID

    if (['approve', 'reject', 'approved', 'rejected'].includes(body.action)) {
      try {
        const decision = body.action.startsWith('approve') ? 'approved' : 'rejected'
        await decideEnrollment(uid, appId, decision, Date.now())
        await notifyInfluencerDecision(uid, decision)
        return Response.json({ ok: true })
      } catch (err) {
        if (err instanceof Error) return Response.json({ error: err.message }, { status: 400 })
        throw err
      }
    }

    if (body.action === 'update-rates') {
      try {
        await updateAppCommission(uid, appId, { signupPaise: body.signupPaise, perPlan: body.perPlan })
        return Response.json({ ok: true })
      } catch (err) {
        if (err instanceof Error) return Response.json({ error: err.message }, { status: 400 })
        throw err
      }
    }

    if (body.action === 'set-code') {
      try {
        const settings = await getSettings()
        const result = await changeAppPromoCode(uid, appId, String(body.code ?? ''), Date.now(), settings.promoDefaultExpiryMonths)
        return Response.json({ ok: true, ...result })
      } catch (err) {
        if (err instanceof Error) return Response.json({ error: err.message }, { status: 400 })
        throw err
      }
    }

    if (body.action === 'request-payout') {
      try {
        const upiId = normalizeUpiId(body.upiId)
        const enrollment = await getEnrollment(uid, appId)
        if (!enrollment || enrollment.status !== 'approved') {
          return Response.json({ error: 'approved enrollment required' }, { status: 400 })
        }
        const request = await requestPayout(uid, 0, upiId, Date.now())
        await notifyPayoutRequest({ uid, amountPaise: request.amountPaise, upiId: request.upiId })
        return Response.json({ ok: true, request })
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

    if (body.action === 'decline-payout') {
      try {
        await declinePayoutRequest(uid, Date.now())
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
