import { createHash } from 'node:crypto'
import { getApp } from '@/config/apps'
import { emailConfigured, sendEmail } from '@/lib/server/email/mailer'
import { unsubUrl } from '@/lib/server/email/prefs'
import { EMAILS } from '@/lib/server/email/registry'
import { getAppTemplates } from '@/lib/server/email/templates'
import { influencerCampaign } from '@/lib/server/email/templates/influencer'
import { adminAuth, adminDb } from '@/lib/server/firebase-admin'
import { ForbiddenError, requireAdmin } from '@/lib/server/require-admin'
import { getSettings } from '@/lib/server/settings'
import { UnauthorizedError } from '@/lib/server/verify-token'

export const runtime = 'nodejs'
export const maxDuration = 300

type Recipient = { uid: string; email: string }

type Broadcast = {
  audience: 'users' | 'influencers'
  uids?: string[]
  subject: string
  message: string
  ctaLabel?: string
  ctaUrl?: string
  appId: string
}

function parseBroadcast(body: Record<string, unknown>): Broadcast {
  const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!subject || subject.length > 150) throw new Error('subject required (max 150 chars)')
  if (!message || message.length > 5000) throw new Error('message required (max 5000 chars)')
  const audience = body.audience === 'influencers' ? 'influencers' : 'users'
  const ctaLabel = typeof body.ctaLabel === 'string' ? body.ctaLabel.trim() : ''
  const ctaUrl = typeof body.ctaUrl === 'string' ? body.ctaUrl.trim() : ''
  if (ctaUrl && !/^https?:\/\//.test(ctaUrl)) throw new Error('CTA link must be an http(s) URL')
  const appId = typeof body.appId === 'string' && getApp(body.appId) ? body.appId : 'crackloop'
  const uids = Array.isArray(body.uids) ? body.uids.filter((u): u is string => typeof u === 'string').slice(0, 500) : undefined
  return { audience, uids, subject, message, ctaLabel, ctaUrl, appId }
}

function renderFor(b: Broadcast, uid: string): { subject: string; html: string } {
  const cta = b.ctaLabel && b.ctaUrl ? { label: b.ctaLabel, url: b.ctaUrl } : null
  if (b.audience === 'influencers') {
    return influencerCampaign({
      subject: b.subject,
      message: b.message,
      cta,
      unsubscribe: { url: unsubUrl(uid, 'influencer'), category: 'influencer' },
    })
  }
  const templates = getAppTemplates(b.appId)
  if (!templates) throw new Error(`no email templates for app ${b.appId}`)
  return templates.announcement({
    subject: b.subject,
    message: b.message,
    cta,
    unsubscribe: { url: unsubUrl(uid, 'marketing'), category: 'marketing' },
  })
}

async function listAllUsers(): Promise<Recipient[]> {
  const out: Recipient[] = []
  let pageToken: string | undefined
  do {
    const page = await adminAuth().listUsers(1000, pageToken)
    for (const u of page.users) if (u.email) out.push({ uid: u.uid, email: u.email })
    pageToken = page.pageToken
  } while (pageToken)
  return out
}

async function listInfluencers(uids?: string[]): Promise<Recipient[]> {
  // Approval lives per-app on influencerApps; a partner approved for multiple apps
  // must still get a single email, so collapse to unique uids.
  const snap = await adminDb().collection('influencerApps').where('status', '==', 'approved').get()
  const unique = new Set(
    snap.docs.map((d) => (d.data() as { uid?: string }).uid).filter((u): u is string => typeof u === 'string'),
  )
  let ids = [...unique]
  if (uids?.length) {
    const allowed = new Set(uids)
    ids = ids.filter((id) => allowed.has(id))
  }
  const out: Recipient[] = []
  for (let i = 0; i < ids.length; i += 100) {
    const res = await adminAuth().getUsers(ids.slice(i, i + 100).map((uid) => ({ uid })))
    for (const u of res.users) if (u.email) out.push({ uid: u.uid, email: u.email })
  }
  return out
}

export async function GET(req: Request): Promise<Response> {
  try {
    await requireAdmin(req)
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'unauthorized' }, { status: 401 })
    if (err instanceof ForbiddenError) return Response.json({ error: 'forbidden' }, { status: 403 })
    throw err
  }
  const settings = await getSettings()
  return Response.json({
    configured: emailConfigured(),
    enabled: settings.emailEnabled,
    from: process.env.GMAIL_USER ?? null,
  })
}

export async function POST(req: Request): Promise<Response> {
  let admin: { uid: string; email: string | null }
  try {
    admin = await requireAdmin(req)
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'unauthorized' }, { status: 401 })
    if (err instanceof ForbiddenError) return Response.json({ error: 'forbidden' }, { status: 403 })
    throw err
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const broadcast = parseBroadcast(body)

    if (!emailConfigured()) return Response.json({ error: 'email not configured (GMAIL_USER / GMAIL_APP_PASSWORD / EMAIL_UNSUB_SECRET)' }, { status: 400 })
    if (!(await getSettings()).emailEnabled) return Response.json({ error: 'emails are disabled in settings' }, { status: 400 })

    if (body.action === 'test') {
      if (!admin.email) return Response.json({ error: 'admin account has no email' }, { status: 400 })
      const rendered = renderFor(broadcast, admin.uid)
      const result = await sendEmail({
        to: admin.email,
        uid: admin.uid,
        category: 'transactional',
        subject: `[TEST] ${rendered.subject}`,
        html: rendered.html,
      })
      return result.sent ? Response.json({ ok: true, sent: 1 }) : Response.json({ error: result.reason ?? 'send failed' }, { status: 500 })
    }

    const recipients =
      broadcast.audience === 'influencers' ? await listInfluencers(broadcast.uids) : await listAllUsers()

    let sent = 0
    let skipped = 0
    let failed = 0
    const category =
      broadcast.audience === 'influencers' ? EMAILS.partnerCampaign.category : EMAILS.announcement.category
    // Stable per-campaign id so re-running the same broadcast dedupes per recipient
    // (sendEmail claims the key atomically) instead of double-sending.
    const campaignId = createHash('sha256')
      .update(`${broadcast.audience}:${broadcast.appId}:${broadcast.subject}:${broadcast.message}`)
      .digest('hex')
      .slice(0, 12)
    const CONCURRENCY = 5
    for (let i = 0; i < recipients.length; i += CONCURRENCY) {
      const chunk = recipients.slice(i, i + CONCURRENCY)
      const results = await Promise.all(
        chunk.map(async (r) => {
          try {
            const rendered = renderFor(broadcast, r.uid)
            return await sendEmail({ to: r.email, uid: r.uid, category, dedupeKey: `bcast-${campaignId}-${r.uid}`, ...rendered })
          } catch (err) {
            console.error('broadcast send failed', r.uid, err)
            return { sent: false, reason: 'error' }
          }
        }),
      )
      for (const res of results) {
        if (res.sent) sent++
        else if (res.reason === 'unsubscribed') skipped++
        else failed++
      }
    }
    return Response.json({ ok: true, total: recipients.length, sent, skipped, failed })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'broadcast failed'
    console.error('admin email broadcast failed', err)
    return Response.json({ error: message }, { status: 400 })
  }
}
