import { describe, expect, it } from 'vitest'
import { EMAILS, EMAIL_TOGGLES, EMAIL_TOGGLE_DEFAULTS, isEmailSenderEnabled } from './registry'

describe('email registry', () => {
  it('derives toggle defaults from gated emails only', () => {
    expect(EMAIL_TOGGLE_DEFAULTS).toEqual({
      emailWelcome: true,
      emailInfluencerDecision: true,
      emailInfluencerEarning: true,
      emailExpiryReminder: true,
      emailPayoutRequest: true,
    })
  })

  it('exposes one admin row per gated email', () => {
    expect(EMAIL_TOGGLES.map((t) => t.key)).toEqual(Object.keys(EMAIL_TOGGLE_DEFAULTS))
    for (const row of EMAIL_TOGGLES) expect(row.label.length).toBeGreaterThan(0)
  })

  it('gates on the master switch first', () => {
    expect(isEmailSenderEnabled('welcome', { emailEnabled: false, emailWelcome: true })).toBe(false)
    expect(isEmailSenderEnabled('welcome', { emailEnabled: true, emailWelcome: true })).toBe(true)
  })

  it('respects the per-email toggle when master is on', () => {
    expect(isEmailSenderEnabled('welcome', { emailEnabled: true, emailWelcome: false })).toBe(false)
    expect(isEmailSenderEnabled('payoutRequest', { emailEnabled: true, emailPayoutRequest: false })).toBe(false)
  })

  it('defaults a missing toggle to on', () => {
    expect(isEmailSenderEnabled('welcome', { emailEnabled: true })).toBe(true)
  })

  it('always allows manual broadcasts (no toggle) when master is on', () => {
    expect(EMAILS.announcement.toggleKey).toBeNull()
    expect(isEmailSenderEnabled('announcement', { emailEnabled: true })).toBe(true)
    expect(isEmailSenderEnabled('announcement', { emailEnabled: false })).toBe(false)
  })
})
