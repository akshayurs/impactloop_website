import { getApp } from '@/config/apps'
import { adminDb } from '@/lib/server/firebase-admin'
import { isLiveStatus } from '@/lib/server/entitlements'
import { getSettings } from '@/lib/server/settings'
import { grantTrial } from '@/lib/server/trial'
import { requireUser, UnauthorizedError } from '@/lib/server/verify-token'

export const runtime = 'nodejs'

export async function POST(req: Request): Promise<Response> {
  let uid: string
  try {
    ;({ uid } = await requireUser(req))
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'unauthorized' }, { status: 401 })
    throw err
  }

  try {
    const body = await req.json().catch(() => ({}))
    if (typeof body.appId !== 'string' || !getApp(body.appId)) {
      return Response.json({ error: 'unknown app' }, { status: 400 })
    }

    const settings = await getSettings()
    if (!settings.freeTrialEnabled) return Response.json({ error: 'trials not available' }, { status: 403 })

    const snap = await adminDb().doc(`users/${uid}/apps/${body.appId}`).get()
    const data = snap.exists ? snap.data() : undefined
    const status: string | undefined = data?.subscription?.status
    const now = Date.now()
    const trialActive = status === 'trial' && (data?.subscription?.expiryTimeMillis ?? 0) > now
    if (data?.trialUsed || trialActive || (typeof status === 'string' && (isLiveStatus(status) || status === 'lifetime'))) {
      return Response.json({ error: 'not eligible for trial' }, { status: 409 })
    }

    await grantTrial(uid, body.appId, settings.trialDays, now)
    return Response.json({ granted: true, expiresAt: now + settings.trialDays * 86_400_000 })
  } catch (err) {
    console.error('trial grant failed', err)
    return Response.json({ error: 'trial failed' }, { status: 500 })
  }
}
