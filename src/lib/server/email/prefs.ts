import { createHmac, timingSafeEqual } from 'node:crypto'
import { SITE_URL } from '@/config/site'
import { adminDb } from '../firebase-admin'

/* 'transactional' is always delivered (receipts, decisions); the rest are opt-out. */
export type EmailCategory = 'transactional' | 'marketing' | 'reminders' | 'influencer'

export type OptOutCategory = Exclude<EmailCategory, 'transactional'>

export type EmailPrefs = Record<OptOutCategory, boolean>

export const DEFAULT_EMAIL_PREFS: EmailPrefs = {
  marketing: true,
  reminders: true,
  influencer: true,
}

export const CATEGORY_LABELS: Record<OptOutCategory, string> = {
  marketing: 'new plans, offers and announcements',
  reminders: 'subscription renewal and expiry reminders',
  influencer: 'partner program updates and campaign requests',
}

export function isOptOutCategory(cat: string): cat is OptOutCategory {
  return cat in DEFAULT_EMAIL_PREFS
}

export async function getEmailPrefs(uid: string): Promise<EmailPrefs> {
  const snap = await adminDb().doc(`emailPrefs/${uid}`).get()
  const stored = snap.exists ? (snap.data() as Partial<EmailPrefs>) : {}
  return { ...DEFAULT_EMAIL_PREFS, ...stored }
}

export async function setEmailPref(uid: string, category: OptOutCategory, subscribed: boolean): Promise<void> {
  await adminDb().doc(`emailPrefs/${uid}`).set({ [category]: subscribed }, { merge: true })
}

function unsubSecret(): string {
  const secret = process.env.EMAIL_UNSUB_SECRET
  if (!secret) throw new Error('EMAIL_UNSUB_SECRET env missing')
  return secret
}

export function unsubToken(uid: string, category: OptOutCategory): string {
  return createHmac('sha256', unsubSecret()).update(`${uid}:${category}`).digest('hex').slice(0, 32)
}

export function verifyUnsubToken(uid: string, category: string, token: string): boolean {
  if (!uid || !token || !isOptOutCategory(category) || !process.env.EMAIL_UNSUB_SECRET) return false
  const expected = unsubToken(uid, category)
  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function unsubUrl(uid: string, category: OptOutCategory): string {
  const params = new URLSearchParams({ u: uid, c: category, t: unsubToken(uid, category) })
  return `${SITE_URL}/unsubscribe?${params}`
}

/** RFC 8058 one-click target: mail clients POST here; a human GET redirects to the page. */
export function unsubPostUrl(uid: string, category: OptOutCategory): string {
  const params = new URLSearchParams({ u: uid, c: category, t: unsubToken(uid, category) })
  return `${SITE_URL}/api/unsubscribe?${params}`
}
