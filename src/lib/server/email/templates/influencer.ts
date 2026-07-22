import { SITE_URL } from '@/config/site'
import { bulletList, ctaButton, paragraphs, renderBaseEmail, statBox, type EmailCta, type RenderedEmail } from './base'
import type { Unsubscribe } from './types'

const PORTAL_URL = `${SITE_URL}/influencer`

function firstName(name: string | null): string {
  return name?.trim().split(/\s+/)[0] || 'there'
}

export function influencerApproved(input: { name: string | null }): RenderedEmail {
  return renderBaseEmail({
    subject: 'You are in — your Impact Loop partner application is approved',
    preheader: 'Pick your promo code and start earning on every referral.',
    kicker: 'Partner Program · Approved',
    heading: `Welcome aboard, ${firstName(input.name)}.`,
    bodyHtml: [
      paragraphs(`Good news — we reviewed your application and you are now an approved Impact Loop partner. Three steps to your first payout:`),
      bulletList([
        `<strong>Claim your promo code</strong> — pick a memorable code in the partner portal. Your audience gets a discount, you get commission.`,
        `<strong>Share it</strong> — drop the code in your videos, posts and bio links.`,
        `<strong>Track earnings</strong> — every referral, your commission and payout history live in the portal, updated in real time.`,
      ]),
      ctaButton({ label: 'Open the partner portal', url: PORTAL_URL }),
      paragraphs(`Questions about rates or payouts? Just reply to this email.`),
    ].join(''),
  })
}

export function influencerRejected(input: { name: string | null }): RenderedEmail {
  return renderBaseEmail({
    subject: 'Update on your Impact Loop partner application',
    preheader: 'We could not approve your application this time.',
    kicker: 'Partner Program · Application',
    heading: `Thanks for applying, ${firstName(input.name)}.`,
    bodyHtml: paragraphs(
      `We took a close look at your application to the Impact Loop partner program, and unfortunately we are not able to approve it right now.\n\nThis is usually about audience fit or channel size rather than anything you did wrong — and it is not permanent. As your channels grow you are welcome to apply again.\n\nIf you think we got this wrong or want feedback, just reply to this email.`,
    ),
  })
}

export function influencerEarning(input: {
  name: string | null
  amount: string
  planLabel: string
  balance: string
  unsubscribe?: Unsubscribe
}): RenderedEmail {
  return renderBaseEmail({
    subject: `Cha-ching — you earned ${input.amount} on a referral`,
    preheader: `Someone subscribed with your code. Current balance: ${input.balance}.`,
    kicker: 'Partner Program · Earnings',
    heading: `Your code just converted.`,
    bodyHtml: [
      paragraphs(`Nice one, ${firstName(input.name)} — someone just purchased using your promo code.`),
      statBox([
        { label: 'Plan purchased', value: input.planLabel },
        { label: 'Your commission', value: input.amount },
        { label: 'Current balance', value: input.balance },
      ]),
      ctaButton({ label: 'View my earnings', url: PORTAL_URL }),
      paragraphs(`Keep sharing your code — every conversion lands here automatically.`),
    ].join(''),
    unsubscribe: input.unsubscribe,
  })
}

/** Internal ops alert sent to the payments account — not partner-facing. */
export function payoutRequestAlert(input: {
  name: string | null
  email: string
  amount: string
  upiId: string
}): RenderedEmail {
  return renderBaseEmail({
    subject: `Payout requested — ${input.amount} to ${input.upiId}`,
    preheader: `${input.email} requested a payout of ${input.amount}.`,
    kicker: 'Partner Program · Payout request',
    heading: 'New payout request',
    bodyHtml: [
      paragraphs(`A partner has requested a payout. Pay to the UPI ID below, then mark it paid in the admin panel.`),
      statBox([
        { label: 'Partner', value: input.name ? `${input.name} (${input.email})` : input.email },
        { label: 'Amount', value: input.amount },
        { label: 'UPI ID', value: input.upiId },
      ]),
      ctaButton({ label: 'Review in admin', url: `${SITE_URL}/admin/influencers` }),
    ].join(''),
  })
}

export function influencerCampaign(input: {
  subject: string
  message: string
  cta?: EmailCta | null
  unsubscribe?: Unsubscribe
}): RenderedEmail {
  return renderBaseEmail({
    subject: input.subject,
    preheader: input.message.split('\n')[0]?.slice(0, 140) ?? input.subject,
    kicker: 'Partner Program',
    heading: input.subject,
    bodyHtml: [
      paragraphs(input.message),
      input.cta ? ctaButton(input.cta) : ctaButton({ label: 'Open the partner portal', url: PORTAL_URL }),
    ].join(''),
    unsubscribe: input.unsubscribe,
  })
}
