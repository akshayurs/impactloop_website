import type { EmailCategory } from './prefs'

/* Single source of truth for every email the product can send.
   Adding a gated email here automatically propagates to the settings type,
   defaults, admin toggles, and the send-gate — no other file needs editing.
   This module is pure data (client-safe): no server-only imports. */

export type EmailId =
  | 'welcome'
  | 'influencerDecision'
  | 'influencerEarning'
  | 'expiryReminder'
  | 'payoutRequest'
  | 'announcement'
  | 'partnerCampaign'

/** Settings keys that gate an email at the sender side. */
export type EmailToggleKey =
  | 'emailWelcome'
  | 'emailInfluencerDecision'
  | 'emailInfluencerEarning'
  | 'emailExpiryReminder'
  | 'emailPayoutRequest'

export type EmailDef = {
  id: EmailId
  label: string
  description: string
  category: EmailCategory
  /** Admin toggle that must be on for this email to send; null = no per-email toggle. */
  toggleKey: EmailToggleKey | null
  /** Default state of the toggle when a setting has never been written. */
  defaultOn: boolean
  /** true = fired by an event or cron; false = manually sent from the Emails tab. */
  automatic: boolean
}

export const EMAILS: Record<EmailId, EmailDef> = {
  welcome: {
    id: 'welcome',
    label: 'Welcome email on purchase',
    description: 'Sent on the first successful purchase per user + app.',
    category: 'transactional',
    toggleKey: 'emailWelcome',
    defaultOn: true,
    automatic: true,
  },
  influencerDecision: {
    id: 'influencerDecision',
    label: 'Partner approved / rejected',
    description: 'Sent when an admin decides an influencer application.',
    category: 'transactional',
    toggleKey: 'emailInfluencerDecision',
    defaultOn: true,
    automatic: true,
  },
  influencerEarning: {
    id: 'influencerEarning',
    label: 'Partner commission earned',
    description: 'Sent when a referral commission is recorded, with the running balance.',
    category: 'influencer',
    toggleKey: 'emailInfluencerEarning',
    defaultOn: true,
    automatic: true,
  },
  expiryReminder: {
    id: 'expiryReminder',
    label: 'Expiry / renewal reminders',
    description: 'Daily cron for subscriptions expiring within the reminder window.',
    category: 'reminders',
    toggleKey: 'emailExpiryReminder',
    defaultOn: true,
    automatic: true,
  },
  payoutRequest: {
    id: 'payoutRequest',
    label: 'Payout request alert (internal)',
    description: 'Internal alert to PAYMENTS_EMAIL when a partner requests a payout.',
    category: 'transactional',
    toggleKey: 'emailPayoutRequest',
    defaultOn: true,
    automatic: true,
  },
  announcement: {
    id: 'announcement',
    label: 'Announcement broadcast',
    description: 'Manual marketing broadcast to all users from the Emails tab.',
    category: 'marketing',
    toggleKey: null,
    defaultOn: true,
    automatic: false,
  },
  partnerCampaign: {
    id: 'partnerCampaign',
    label: 'Partner campaign nudge',
    description: 'Manual campaign email to approved partners from the Emails tab.',
    category: 'influencer',
    toggleKey: null,
    defaultOn: true,
    automatic: false,
  },
}

export const EMAIL_LIST: EmailDef[] = Object.values(EMAILS)

/** Toggle keys and their defaults, derived from the registry. Consumed by settings.ts. */
export const EMAIL_TOGGLE_DEFAULTS: Record<EmailToggleKey, boolean> = Object.fromEntries(
  EMAIL_LIST.filter((e): e is EmailDef & { toggleKey: EmailToggleKey } => e.toggleKey !== null).map((e) => [
    e.toggleKey,
    e.defaultOn,
  ]),
) as Record<EmailToggleKey, boolean>

/** Rows for the admin settings UI, derived from the registry. */
export const EMAIL_TOGGLES: Array<{ key: EmailToggleKey; label: string; description: string }> = EMAIL_LIST.filter(
  (e): e is EmailDef & { toggleKey: EmailToggleKey } => e.toggleKey !== null,
).map((e) => ({ key: e.toggleKey, label: e.label, description: e.description }))

export type EmailGateSettings = { emailEnabled: boolean } & Partial<Record<EmailToggleKey, boolean>>

/** True when the sender side (master switch + per-email toggle) allows this email. */
export function isEmailSenderEnabled(id: EmailId, settings: EmailGateSettings): boolean {
  if (!settings.emailEnabled) return false
  const { toggleKey } = EMAILS[id]
  if (!toggleKey) return true
  return settings[toggleKey] !== false
}
