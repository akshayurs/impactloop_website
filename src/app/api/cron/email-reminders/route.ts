import { adminDb } from '@/lib/server/firebase-admin'
import { sendExpiryReminder } from '@/lib/server/email/notify'
import { isEmailSenderEnabled } from '@/lib/server/email/registry'
import { isLiveStatus } from '@/lib/server/entitlements'
import { getSettings } from '@/lib/server/settings'

export const runtime = 'nodejs'
export const maxDuration = 300

const DAY_MS = 86_400_000

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const settings = await getSettings()
  if (!isEmailSenderEnabled('expiryReminder', settings)) {
    return Response.json({ ok: true, skipped: 'reminders disabled' })
  }

  const now = Date.now()
  const windowEnd = now + settings.emailExpiryReminderDays * DAY_MS

  const snap = await adminDb()
    .collectionGroup('apps')
    .where('subscription.expiryTimeMillis', '>', now)
    .where('subscription.expiryTimeMillis', '<=', windowEnd)
    .get()

  let sent = 0
  let considered = 0
  for (const doc of snap.docs) {
    const data = doc.data()
    const sub = data?.subscription
    if (!sub || !(isLiveStatus(sub.status) || sub.status === 'trial')) continue
    // Path: users/{uid}/apps/{appId}
    const [root, uid, , appId] = doc.ref.path.split('/')
    if (root !== 'users' || !uid || !appId) continue
    considered++
    const ok = await sendExpiryReminder({
      uid,
      appId,
      planId: sub.planId,
      expiryTimeMillis: sub.expiryTimeMillis,
      autoRenewing: Boolean(sub.autoRenewing) && sub.status !== 'trial',
    })
    if (ok) sent++
  }

  return Response.json({ ok: true, matched: snap.size, considered, sent })
}
