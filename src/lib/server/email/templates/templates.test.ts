import { describe, expect, it } from 'vitest'
import { esc, paragraphs, renderBaseEmail } from './base'
import { crackloopTemplates } from './crackloop'
import { getAppTemplates } from './index'
import { influencerApproved, influencerEarning, influencerRejected, payoutRequestAlert } from './influencer'

describe('email templates', () => {
  it('escapes html in user-controlled fields', () => {
    expect(esc('<b>&"')).toBe('&lt;b&gt;&amp;&quot;')
    const { html } = renderBaseEmail({
      subject: '<script>x</script>',
      preheader: 'p',
      kicker: 'k',
      heading: '<img>',
      bodyHtml: paragraphs('<u>hi</u>'),
    })
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img>')
    expect(html).toContain('&lt;u&gt;hi&lt;/u&gt;')
  })

  it('splits paragraphs on blank lines', () => {
    const out = paragraphs('one\n\ntwo\nthree')
    expect(out.match(/<p /g)).toHaveLength(2)
    expect(out).toContain('two<br/>three')
  })

  it('registry resolves crackloop and rejects unknown apps', () => {
    expect(getAppTemplates('crackloop')).toBe(crackloopTemplates)
    expect(getAppTemplates('unknown-app')).toBeNull()
  })

  it('welcome email includes plan and play store link', () => {
    const { subject, html } = crackloopTemplates.welcome({ name: 'Asha Rao', planLabel: 'Pro · Monthly' })
    expect(subject).toContain('CrackLoop')
    expect(subject).toContain('Pro · Monthly')
    expect(html).toContain('Asha')
    expect(html).toContain('play.google.com')
  })

  it('expiry reminder differs for auto-renew vs expiring', () => {
    const base = { name: null, planLabel: 'Pro · Monthly', expiryDate: '20 July 2026' }
    const renew = crackloopTemplates.expiryReminder({ ...base, autoRenewing: true })
    const expire = crackloopTemplates.expiryReminder({ ...base, autoRenewing: false })
    expect(renew.subject).toContain('renews')
    expect(expire.subject).toContain('expires')
    expect(expire.html).toContain('/pricing')
  })

  it('unsubscribe footer appears only when provided', () => {
    const withUnsub = crackloopTemplates.announcement({
      subject: 'New plan',
      message: 'Check it out.',
      unsubscribe: { url: 'https://example.com/unsubscribe?u=1', category: 'marketing' },
    })
    expect(withUnsub.html).toContain('https://example.com/unsubscribe?u=1')
    expect(withUnsub.html).toContain('Unsubscribe')
    const noUnsub = influencerApproved({ name: 'Dev' })
    expect(noUnsub.html).not.toContain('>Unsubscribe<')
  })

  it('influencer emails render decision and earnings', () => {
    expect(influencerApproved({ name: 'Dev Patel' }).html).toContain('partner portal')
    expect(influencerRejected({ name: null }).subject).toContain('application')
    const earn = influencerEarning({ name: null, amount: '₹150', planLabel: 'Pro · Monthly', balance: '₹1,250' })
    expect(earn.html).toContain('₹150')
    expect(earn.html).toContain('₹1,250')
  })

  it('payout request alert includes amount, UPI and partner', () => {
    const alert = payoutRequestAlert({ name: 'Aditi', email: 'aditi@x.com', amount: '₹640', upiId: 'aditi@okhdfcbank' })
    expect(alert.subject).toContain('₹640')
    expect(alert.subject).toContain('aditi@okhdfcbank')
    expect(alert.html).toContain('aditi@x.com')
    expect(alert.html).toContain('/admin/influencers')
  })
})
