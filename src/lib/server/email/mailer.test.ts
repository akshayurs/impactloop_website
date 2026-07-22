import { beforeEach, describe, expect, it, vi } from 'vitest'

const { docGet, docSet, docCreate, sendMail, settings } = vi.hoisted(() => ({
  docGet: vi.fn(),
  docSet: vi.fn(),
  docCreate: vi.fn(),
  sendMail: vi.fn(),
  settings: { emailEnabled: true },
}))

vi.mock('../firebase-admin', () => ({
  adminDb: () => ({
    doc: () => ({ get: docGet, set: docSet, create: docCreate }),
    collection: () => ({ doc: () => ({ get: docGet, set: docSet, create: docCreate }) }),
  }),
}))
vi.mock('../settings', () => ({ getSettings: () => Promise.resolve(settings) }))
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail }) } }))

import { emailConfigured, sendEmail } from './mailer'

const BASE = { to: 'a@b.c', uid: 'u1', subject: 's', html: '<p>x</p>' } as const

describe('mailer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GMAIL_USER = 'sender@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'pass'
    process.env.EMAIL_UNSUB_SECRET = 'secret'
    settings.emailEnabled = true
    docGet.mockResolvedValue({ exists: false, data: () => undefined })
    docSet.mockResolvedValue(undefined)
    docCreate.mockResolvedValue(undefined)
    sendMail.mockResolvedValue({})
  })

  it('reports configuration from env', () => {
    expect(emailConfigured()).toBe(true)
    delete process.env.GMAIL_APP_PASSWORD
    expect(emailConfigured()).toBe(false)
  })

  it('skips when not configured', async () => {
    delete process.env.GMAIL_USER
    await expect(sendEmail({ ...BASE, category: 'transactional' })).resolves.toEqual({ sent: false, reason: 'not configured' })
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('skips when disabled in settings', async () => {
    settings.emailEnabled = false
    await expect(sendEmail({ ...BASE, category: 'transactional' })).resolves.toEqual({ sent: false, reason: 'disabled in settings' })
  })

  it('sends transactional mail without checking prefs and logs it', async () => {
    const res = await sendEmail({ ...BASE, category: 'transactional' })
    expect(res).toEqual({ sent: true })
    expect(sendMail).toHaveBeenCalledOnce()
    const args = sendMail.mock.calls[0][0]
    expect(args.to).toBe('a@b.c')
    expect(args.headers).toBeUndefined()
    expect(docSet).toHaveBeenCalledWith(expect.objectContaining({ ok: true, uid: 'u1', category: 'transactional' }))
  })

  it('respects unsubscribe prefs for opt-out categories', async () => {
    docGet.mockResolvedValue({ exists: true, data: () => ({ marketing: false }) })
    await expect(sendEmail({ ...BASE, category: 'marketing' })).resolves.toEqual({ sent: false, reason: 'unsubscribed' })
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('adds one-click List-Unsubscribe headers for opt-out categories', async () => {
    await sendEmail({ ...BASE, category: 'marketing' })
    const headers = sendMail.mock.calls[0][0].headers
    expect(headers['List-Unsubscribe']).toContain('/api/unsubscribe?')
    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })

  it('dedupes atomically on dedupeKey', async () => {
    docCreate
      .mockResolvedValueOnce(undefined) // first send: claim succeeds
      .mockRejectedValueOnce(Object.assign(new Error('exists'), { code: 6 })) // second: already claimed
    await expect(sendEmail({ ...BASE, category: 'transactional', dedupeKey: 'k1' })).resolves.toEqual({ sent: true })
    await expect(sendEmail({ ...BASE, category: 'transactional', dedupeKey: 'k1' })).resolves.toEqual({ sent: false, reason: 'duplicate' })
    expect(sendMail).toHaveBeenCalledOnce()
  })

  it('records failures without throwing', async () => {
    sendMail.mockRejectedValue(new Error('smtp down'))
    await expect(sendEmail({ ...BASE, category: 'transactional' })).resolves.toEqual({ sent: false, reason: 'smtp down' })
    expect(docSet).toHaveBeenCalledWith(expect.objectContaining({ ok: false, error: 'smtp down' }))
  })
})
