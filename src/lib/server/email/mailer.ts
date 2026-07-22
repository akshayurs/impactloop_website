import nodemailer from 'nodemailer'
import type Mail from 'nodemailer/lib/mailer'
import { adminDb } from '../firebase-admin'
import { getSettings } from '../settings'
import { getEmailPrefs, isOptOutCategory, unsubPostUrl, type EmailCategory } from './prefs'

/* Transport is a thin seam: one implementation per provider, selected by EMAIL_PROVIDER.
   Gmail SMTP is the free default. To add Resend/Brevo/SES, implement EmailTransport and
   register it in PROVIDERS — no caller changes needed. */
export type OutgoingEmail = {
  from: string
  to: string
  subject: string
  html: string
  headers?: Record<string, string>
}

export type EmailTransport = {
  configured(): boolean
  send(msg: OutgoingEmail): Promise<void>
}

let cachedGmail: Mail | null = null

function gmailTransport(): EmailTransport {
  return {
    configured: () => Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
    async send(msg) {
      if (!cachedGmail) {
        const user = process.env.GMAIL_USER
        const pass = process.env.GMAIL_APP_PASSWORD
        if (!user || !pass) throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD env missing')
        cachedGmail = nodemailer.createTransport({ service: 'gmail', pool: true, maxConnections: 3, auth: { user, pass } })
      }
      await cachedGmail.sendMail(msg)
    },
  }
}

/* Resend (REST). Set EMAIL_PROVIDER=resend + RESEND_API_KEY, and EMAIL_FROM to a sender on
   a Resend-verified domain. Gives real bounce/complaint feedback (via Resend webhooks —
   handling those is a follow-up) that Gmail SMTP can't. */
function resendTransport(): EmailTransport {
  return {
    configured: () => Boolean(process.env.RESEND_API_KEY),
    async send(msg) {
      const key = process.env.RESEND_API_KEY
      if (!key) throw new Error('RESEND_API_KEY env missing')
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: msg.from, to: msg.to, subject: msg.subject, html: msg.html, headers: msg.headers }),
      })
      if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
    },
  }
}

const PROVIDERS: Record<string, () => EmailTransport> = {
  gmail: gmailTransport,
  resend: resendTransport,
}

function transport(): EmailTransport {
  const provider = process.env.EMAIL_PROVIDER ?? 'gmail'
  const factory = PROVIDERS[provider]
  if (!factory) throw new Error(`unknown EMAIL_PROVIDER: ${provider}`)
  return factory()
}

function fromAddress(): string {
  return process.env.EMAIL_FROM ?? `"Impact Loop" <${process.env.GMAIL_USER}>`
}

/* EMAIL_UNSUB_SECRET is required regardless of provider (signs unsubscribe links). */
export function emailConfigured(): boolean {
  return Boolean(process.env.EMAIL_UNSUB_SECRET) && transport().configured()
}

export type SendResult = { sent: boolean; reason?: string }

export type SendEmailInput = {
  to: string
  uid: string
  subject: string
  html: string
  category: EmailCategory
  /** When set, the same key never sends twice (emailLog doc id). */
  dedupeKey?: string
}

/* Every attempt is recorded in emailLog for admin visibility and reminder dedupe. */
export async function sendEmail(input: SendEmailInput): Promise<SendResult> {
  if (!emailConfigured()) return { sent: false, reason: 'not configured' }
  if (!(await getSettings()).emailEnabled) return { sent: false, reason: 'disabled in settings' }

  if (isOptOutCategory(input.category)) {
    const prefs = await getEmailPrefs(input.uid)
    if (!prefs[input.category]) return { sent: false, reason: 'unsubscribed' }
  }

  const db = adminDb()
  const logRef = input.dedupeKey ? db.doc(`emailLog/${input.dedupeKey}`) : db.collection('emailLog').doc()
  // Atomic claim: concurrent sends with the same key can't both pass (e.g. the
  // webhook and checkout/verify both firing the welcome email for one order).
  if (input.dedupeKey) {
    try {
      await logRef.create({ to: input.to, uid: input.uid, category: input.category, subject: input.subject, claimedAt: Date.now() })
    } catch (err) {
      if ((err as { code?: number })?.code === 6) return { sent: false, reason: 'duplicate' } // ALREADY_EXISTS
      throw err
    }
  }

  const log = {
    to: input.to,
    uid: input.uid,
    category: input.category,
    subject: input.subject,
    sentAt: Date.now(),
  }
  try {
    await transport().send({
      from: fromAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      headers: isOptOutCategory(input.category)
        ? {
            'List-Unsubscribe': `<${unsubPostUrl(input.uid, input.category)}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          }
        : undefined,
    })
    await logRef.set({ ...log, ok: true })
    return { sent: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'send failed'
    await logRef.set({ ...log, ok: false, error: message }).catch(() => {})
    return { sent: false, reason: message }
  }
}
