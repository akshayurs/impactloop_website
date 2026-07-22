import { getApp } from '@/config/apps'
import { SITE_URL } from '@/config/site'
import {
  bulletList,
  ctaButton,
  esc,
  paragraphs,
  renderBaseEmail,
  statBox,
  type EmailCta,
} from '../base'
import type { AppEmailTemplates } from '../types'

const APP_ID = 'crackloop'

function app() {
  const info = getApp(APP_ID)
  if (!info) throw new Error('crackloop app config missing')
  return info
}

function firstName(name: string | null): string {
  return name?.trim().split(/\s+/)[0] || 'there'
}

const welcome: AppEmailTemplates['welcome'] = ({ name, planLabel, unsubscribe }) => {
  const { name: appName, playStoreUrl } = app()
  return renderBaseEmail({
    subject: `Welcome to ${appName} — your ${planLabel} plan is live`,
    preheader: `Your ${planLabel} plan is active. Here is how to get started.`,
    kicker: `${appName} · Welcome`,
    heading: `You're in, ${firstName(name)}.`,
    bodyHtml: [
      paragraphs(
        `Your payment went through and your ${planLabel} plan is now active on your account. ${appName} turns interview prep into short daily loops — here is how to get rolling in the next five minutes:`,
      ),
      bulletList([
        `<strong>Install the app</strong> — grab ${esc(appName)} from the Play Store and sign in with the same Google account you used to buy.`,
        `<strong>Pick a track</strong> — DSA, system design, or CS fundamentals. Swipe through concept cards, one idea per screen.`,
        `<strong>Take a quiz</strong> — wrong answers feed your spaced-repetition review deck automatically.`,
        `<strong>Meet the AI tutor</strong> — ask anything mid-topic, or run a voice mock interview when you feel brave.`,
      ]),
      ctaButton({ label: `Get ${appName} on Google Play`, url: playStoreUrl }),
      paragraphs(`Your plan, receipts and subscription controls live in your account page any time.\n\nHappy cracking — see you on the leaderboard.`),
    ].join(''),
    unsubscribe,
  })
}

const expiryReminder: AppEmailTemplates['expiryReminder'] = ({ name, planLabel, expiryDate, autoRenewing, unsubscribe }) => {
  const { name: appName } = app()
  const accountUrl = `${SITE_URL}/account`
  if (autoRenewing) {
    return renderBaseEmail({
      subject: `${appName}: your ${planLabel} plan renews on ${expiryDate}`,
      preheader: `Heads up — your subscription renews automatically on ${expiryDate}.`,
      kicker: `${appName} · Renewal`,
      heading: `Your plan renews soon.`,
      bodyHtml: [
        paragraphs(`Hi ${firstName(name)}, a quick heads-up so there are no surprises:`),
        statBox([
          { label: 'Plan', value: planLabel },
          { label: 'Renews on', value: expiryDate },
          { label: 'Action needed', value: 'None' },
        ]),
        paragraphs(
          `Your ${appName} subscription renews automatically on ${expiryDate}. Nothing to do if you want to keep your streak, review deck and AI tutor exactly as they are.\n\nIf you'd rather not renew, you can cancel from your account page before the renewal date — you keep access until the current period ends.`,
        ),
        ctaButton({ label: 'Manage my subscription', url: accountUrl }),
      ].join(''),
      unsubscribe,
    })
  }
  return renderBaseEmail({
    subject: `${appName}: your ${planLabel} plan expires on ${expiryDate}`,
    preheader: `Your access ends on ${expiryDate}. Renew to keep your progress perks.`,
    kicker: `${appName} · Expiry`,
    heading: `Your plan ends on ${expiryDate}.`,
    bodyHtml: [
      paragraphs(`Hi ${firstName(name)}, your ${appName} ${planLabel} plan is about to run out:`),
      statBox([
        { label: 'Plan', value: planLabel },
        { label: 'Expires on', value: expiryDate },
        { label: 'Auto-renew', value: 'Off' },
      ]),
      paragraphs(
        `After that date the app drops back to the free tier — your progress and streak history stay safe, but ad-free, unlimited AI and premium decks switch off.\n\nRenew any time from the pricing page to keep everything running without a gap.`,
      ),
      ctaButton({ label: 'Renew my plan', url: `${SITE_URL}/pricing` }),
    ].join(''),
    unsubscribe,
  })
}

const announcement: AppEmailTemplates['announcement'] = ({ subject, message, cta, unsubscribe }) => {
  const { name: appName } = app()
  const button: EmailCta | null = cta ?? null
  return renderBaseEmail({
    subject,
    preheader: message.split('\n')[0]?.slice(0, 140) ?? subject,
    kicker: `${appName} · News`,
    heading: subject,
    bodyHtml: [paragraphs(message), button ? ctaButton(button) : ''].join(''),
    unsubscribe,
  })
}

export const crackloopTemplates: AppEmailTemplates = {
  welcome,
  expiryReminder,
  announcement,
}
