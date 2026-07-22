import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireUser, recordReferral, getEnrollment, docGet, docSet } = vi.hoisted(() => ({
  requireUser: vi.fn(), recordReferral: vi.fn(), getEnrollment: vi.fn(), docGet: vi.fn(), docSet: vi.fn(),
}))
vi.mock('@/lib/server/verify-token', () => ({ requireUser, UnauthorizedError: class extends Error { status = 401 } }))
vi.mock('@/lib/server/influencer', () => ({ recordReferral }))
vi.mock('@/lib/server/influencer-apps', () => ({ getEnrollment }))
vi.mock('@/lib/server/firebase-admin', () => ({
  adminDb: () => ({ doc: (path: string) => ({ get: () => docGet(path), set: (d: unknown, o?: unknown) => docSet(path, d, o) }) }),
}))

import { POST } from './route'

function req(body: unknown) {
  return new Request('http://x', { method: 'POST', body: JSON.stringify(body), headers: { Authorization: 'Bearer t' } })
}

const PROMO = { code: 'AK10X', ownerUid: 'inf1', appId: 'crackloop', active: true, createdAt: 0, expiresAt: Date.now() + 10_000_000 }

beforeEach(() => {
  vi.clearAllMocks()
  requireUser.mockResolvedValue({ uid: 'u2', email: null })
  getEnrollment.mockResolvedValue({ status: 'approved', commissionRates: { signupPaise: 500, perPlan: {} } })
  docGet.mockImplementation(async (path: string) => {
    if (path === 'promoCodes/AK10X') return { exists: true, data: () => PROMO }
    if (path === 'users/u2') return { exists: false, data: () => undefined }
    return { exists: false }
  })
})

describe('POST /api/referral/claim', () => {
  it('claims: records attribution only, defers commission to first paid purchase', async () => {
    const res = await POST(req({ code: 'ak10x' }))
    expect(res.status).toBe(200)
    expect((await res.json()).claimed).toBe(true)
    expect(docSet).toHaveBeenCalledWith(
      'users/u2',
      expect.objectContaining({ referredBy: 'AK10X', referredByOwnerUid: 'inf1', referredByAppId: 'crackloop' }),
      { merge: true },
    )
    // No commission at claim time — signup farming guard.
    expect(recordReferral).not.toHaveBeenCalled()
  })
  it('idempotent when already referred', async () => {
    docGet.mockImplementation(async (path: string) =>
      path === 'users/u2'
        ? { exists: true, data: () => ({ referredBy: 'OTHER' }) }
        : { exists: true, data: () => PROMO },
    )
    const json = await (await POST(req({ code: 'AK10X' }))).json()
    expect(json.claimed).toBe(false)
    expect(docSet).not.toHaveBeenCalled()
  })
  it('rejects self-referral', async () => {
    requireUser.mockResolvedValue({ uid: 'inf1', email: null })
    expect((await POST(req({ code: 'AK10X' }))).status).toBe(400)
  })
  it('rejects expired/unknown codes', async () => {
    docGet.mockImplementation(async (path: string) =>
      path === 'promoCodes/AK10X' ? { exists: true, data: () => ({ ...PROMO, expiresAt: 1 }) } : { exists: false },
    )
    expect((await POST(req({ code: 'AK10X' }))).status).toBe(400)
    docGet.mockImplementation(async () => ({ exists: false }))
    expect((await POST(req({ code: 'NOPE1' }))).status).toBe(400)
  })
})
