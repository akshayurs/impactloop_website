import * as Sentry from '@sentry/nextjs'
import type { Plan } from '@/config/plans'
import { formatINR } from '@/lib/format'
import { adminAuth } from '../firebase-admin'
import { getEarnings } from '../influencer'
import { getPlanById } from '../plans-store'
import { getSettings } from '../settings'
import { sendEmail } from './mailer'
import { unsubUrl } from './prefs'
import { EMAILS, isEmailSenderEnabled } from './registry'
import { influencerApproved, influencerEarning, influencerRejected, payoutRequestAlert } from './templates/influencer'
import { getAppTemplates } from './templates'

export function planLabel(plan: Plan): string {
  const tier = plan.tier === 'ai' ? 'AI' : plan.tier.charAt(0).toUpperCase() + plan.tier.slice(1)
  if (plan.lifetime) return `${tier} · Lifetime`
  if (plan.durationMonths === 1) return `${tier} · Monthly`
  return `${tier} · ${plan.durationMonths} months`
}

async function recipient(uid: string): Promise<{ email: string; name: string | null } | null> {
  try {
    const user = await adminAuth().getUser(uid)
    return user.email ? { email: user.email, name: user.displayName ?? null } : null
  } catch {
    return null
  }
}

/* Notify helpers are fire-safe: they log and swallow errors so payment/admin
   flows never fail because Gmail hiccuped. Failures are still reported to Sentry
   so a broken mailer isn't silently invisible. */
function reportEmailError(what: string, err: unknown): void {
  console.error(`email: ${what} failed`, err)
  Sentry.captureException(err, { tags: { area: 'email', kind: what } })
}

export async function notifyInfluencerDecision(uid: string, decision: 'approved' | 'rejected'): Promise<void> {
  try {
    const settings = await getSettings()
    if (!isEmailSenderEnabled('influencerDecision', settings)) return
    const to = await recipient(uid)
    if (!to) return
    const rendered = decision === 'approved' ? influencerApproved({ name: to.name }) : influencerRejected({ name: to.name })
    await sendEmail({ to: to.email, uid, category: EMAILS.influencerDecision.category, ...rendered })
  } catch (err) {
    reportEmailError('influencer decision notify', err)
  }
}

export async function notifyPurchase(input: { uid: string; appId: string; planId: string }): Promise<void> {
  try {
    const settings = await getSettings()
    if (!isEmailSenderEnabled('welcome', settings)) return
    const templates = getAppTemplates(input.appId)
    if (!templates) return
    const [to, plan] = await Promise.all([recipient(input.uid), getPlanById(input.planId)])
    if (!to || !plan) return
    const rendered = templates.welcome({ name: to.name, planLabel: planLabel(plan) })
    await sendEmail({
      to: to.email,
      uid: input.uid,
      category: EMAILS.welcome.category,
      dedupeKey: `welcome-${input.uid}-${input.appId}`,
      ...rendered,
    })
  } catch (err) {
    reportEmailError('purchase notify', err)
  }
}

export async function notifyCommission(input: { ownerUid: string; planId: string; commissionPaise: number }): Promise<void> {
  try {
    const settings = await getSettings()
    if (!isEmailSenderEnabled('influencerEarning', settings)) return
    const to = await recipient(input.ownerUid)
    if (!to) return
    const [plan, earnings] = await Promise.all([getPlanById(input.planId), getEarnings(input.ownerUid)])
    const rendered = influencerEarning({
      name: to.name,
      amount: formatINR(input.commissionPaise),
      planLabel: plan ? planLabel(plan) : input.planId,
      balance: formatINR(earnings.balancePaise),
      unsubscribe: { url: unsubUrl(input.ownerUid, 'influencer'), category: 'influencer' },
    })
    await sendEmail({ to: to.email, uid: input.ownerUid, category: EMAILS.influencerEarning.category, ...rendered })
  } catch (err) {
    reportEmailError('commission notify', err)
  }
}

export async function notifyPayoutRequest(input: { uid: string; amountPaise: number; upiId: string }): Promise<void> {
  try {
    const to = process.env.PAYMENTS_EMAIL
    if (!to) return
    if (!isEmailSenderEnabled('payoutRequest', await getSettings())) return
    const partner = await recipient(input.uid)
    const rendered = payoutRequestAlert({
      name: partner?.name ?? null,
      email: partner?.email ?? input.uid,
      amount: formatINR(input.amountPaise),
      upiId: input.upiId,
    })
    await sendEmail({ to, uid: input.uid, category: EMAILS.payoutRequest.category, ...rendered })
  } catch (err) {
    reportEmailError('payout request notify', err)
  }
}

export async function sendExpiryReminder(input: {
  uid: string
  appId: string
  planId: string
  expiryTimeMillis: number
  autoRenewing: boolean
}): Promise<boolean> {
  try {
    const templates = getAppTemplates(input.appId)
    if (!templates) return false
    const [to, plan] = await Promise.all([recipient(input.uid), getPlanById(input.planId)])
    if (!to || !plan) return false
    const expiryDate = new Date(input.expiryTimeMillis).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    })
    const rendered = templates.expiryReminder({
      name: to.name,
      planLabel: planLabel(plan),
      expiryDate,
      autoRenewing: input.autoRenewing,
      unsubscribe: { url: unsubUrl(input.uid, 'reminders'), category: 'reminders' },
    })
    const result = await sendEmail({
      to: to.email,
      uid: input.uid,
      category: EMAILS.expiryReminder.category,
      dedupeKey: `reminder-${input.uid}-${input.appId}-${input.expiryTimeMillis}`,
      ...rendered,
    })
    return result.sent
  } catch (err) {
    reportEmailError('expiry reminder', err)
    return false
  }
}
