import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireUser, getSettings, grantTrial, docGet } = vi.hoisted(() => ({
  requireUser: vi.fn(), getSettings: vi.fn(), grantTrial: vi.fn(), docGet: vi.fn(),
}))
vi.mock('@/lib/server/verify-token', () => ({ requireUser, UnauthorizedError: class extends Error { status = 401 } }))
vi.mock('@/lib/server/settings', () => ({ getSettings }))
vi.mock('@/lib/server/trial', async (importOriginal) => ({ ...(await importOriginal() as object), grantTrial }))
vi.mock('@/lib/server/firebase-admin', () => ({
  adminDb: () => ({ doc: (path: string) => ({ get: () => docGet(path) }) }),
}))

import { POST } from './route'

function req(body: unknown) {
  return new Request('http://x', { method: 'POST', body: JSON.stringify(body), headers: { Authorization: 'Bearer t' } })
}

describe('POST /api/trial', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireUser.mockResolvedValue({ uid: 'u1', email: null })
    getSettings.mockResolvedValue({ freeTrialEnabled: true, trialDays: 7, promoDefaultExpiryMonths: 3 })
    docGet.mockResolvedValue({ exists: false, data: () => undefined })
  })

  it('403 when trials disabled', async () => {
    getSettings.mockResolvedValue({ freeTrialEnabled: false, trialDays: 7, promoDefaultExpiryMonths: 3 })
    expect((await POST(req({ appId: 'crackloop' }))).status).toBe(403)
  })

  it('400 unknown app', async () => {
    expect((await POST(req({ appId: 'nope' }))).status).toBe(400)
  })

  it('409 when trial already used', async () => {
    docGet.mockResolvedValue({ exists: true, data: () => ({ trialUsed: true }) })
    expect((await POST(req({ appId: 'crackloop' }))).status).toBe(409)
    expect(grantTrial).not.toHaveBeenCalled()
  })

  it('409 when live subscription exists', async () => {
    docGet.mockResolvedValue({ exists: true, data: () => ({ subscription: { status: 'active' } }) })
    expect((await POST(req({ appId: 'crackloop' }))).status).toBe(409)
  })

  it('grants trial when eligible', async () => {
    const res = await POST(req({ appId: 'crackloop' }))
    expect(res.status).toBe(200)
    expect(grantTrial).toHaveBeenCalledWith('u1', 'crackloop', 7, expect.any(Number))
    expect((await res.json()).granted).toBe(true)
  })
})
