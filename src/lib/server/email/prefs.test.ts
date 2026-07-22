import { beforeEach, describe, expect, it, vi } from 'vitest'

const { docGet, docSet } = vi.hoisted(() => ({ docGet: vi.fn(), docSet: vi.fn() }))
vi.mock('../firebase-admin', () => ({
  adminDb: () => ({ doc: () => ({ get: docGet, set: docSet }) }),
}))

import {
  DEFAULT_EMAIL_PREFS,
  getEmailPrefs,
  isOptOutCategory,
  setEmailPref,
  unsubToken,
  unsubUrl,
  verifyUnsubToken,
} from './prefs'

describe('email prefs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.EMAIL_UNSUB_SECRET = 'test-secret'
    docGet.mockResolvedValue({ exists: false, data: () => undefined })
    docSet.mockResolvedValue(undefined)
  })

  it('defaults all opt-out categories to subscribed', async () => {
    await expect(getEmailPrefs('u1')).resolves.toEqual(DEFAULT_EMAIL_PREFS)
    expect(DEFAULT_EMAIL_PREFS).toEqual({ marketing: true, reminders: true, influencer: true })
  })

  it('merges stored prefs over defaults', async () => {
    docGet.mockResolvedValue({ exists: true, data: () => ({ marketing: false }) })
    await expect(getEmailPrefs('u1')).resolves.toEqual({ ...DEFAULT_EMAIL_PREFS, marketing: false })
  })

  it('writes a single category on setEmailPref', async () => {
    await setEmailPref('u1', 'reminders', false)
    expect(docSet).toHaveBeenCalledWith({ reminders: false }, { merge: true })
  })

  it('classifies categories', () => {
    expect(isOptOutCategory('marketing')).toBe(true)
    expect(isOptOutCategory('transactional')).toBe(false)
    expect(isOptOutCategory('nope')).toBe(false)
  })

  it('round-trips unsubscribe tokens and rejects tampering', () => {
    const token = unsubToken('u1', 'marketing')
    expect(verifyUnsubToken('u1', 'marketing', token)).toBe(true)
    expect(verifyUnsubToken('u2', 'marketing', token)).toBe(false)
    expect(verifyUnsubToken('u1', 'reminders', token)).toBe(false)
    expect(verifyUnsubToken('u1', 'marketing', token.slice(0, -1) + 'x')).toBe(false)
    expect(verifyUnsubToken('u1', 'transactional', token)).toBe(false)
    expect(verifyUnsubToken('u1', 'marketing', '')).toBe(false)
  })

  it('builds unsubscribe URLs with uid, category and token', () => {
    const url = new URL(unsubUrl('u1', 'reminders'))
    expect(url.pathname).toBe('/unsubscribe')
    expect(url.searchParams.get('u')).toBe('u1')
    expect(url.searchParams.get('c')).toBe('reminders')
    expect(url.searchParams.get('t')).toBe(unsubToken('u1', 'reminders'))
  })

  it('throws when secret missing', () => {
    delete process.env.EMAIL_UNSUB_SECRET
    expect(() => unsubToken('u1', 'marketing')).toThrow(/EMAIL_UNSUB_SECRET/)
  })
})
