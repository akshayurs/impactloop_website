import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireUser, applyAsInfluencer, getInfluencer, getEarnings, suggestCodes, enroll, listEnrollments, getAppCommission, changeAppPromoCode, getPartnerConfig, getSettings } =
  vi.hoisted(() => ({
    requireUser: vi.fn(), applyAsInfluencer: vi.fn(), getInfluencer: vi.fn(), getEarnings: vi.fn(),
    suggestCodes: vi.fn(() => ['AK10', 'AK25', 'AKVIP']), enroll: vi.fn(), listEnrollments: vi.fn(),
    getAppCommission: vi.fn(), changeAppPromoCode: vi.fn(), getPartnerConfig: vi.fn(), getSettings: vi.fn(),
  }))
vi.mock('@/lib/server/verify-token', () => ({ requireUser, UnauthorizedError: class extends Error { status = 401 } }))
vi.mock('@/lib/server/influencer', () => ({ applyAsInfluencer, getInfluencer, getEarnings, suggestCodes }))
vi.mock('@/lib/server/influencer-apps', () => ({ enroll, listEnrollments, getAppCommission, changeAppPromoCode }))
vi.mock('@/lib/server/partner-config', () => ({ getPartnerConfig }))
vi.mock('@/lib/server/settings', () => ({ getSettings }))

import { POST as applyPOST } from './apply/route'
import { POST as enrollPOST } from './enroll/route'
import { GET as meGET } from './me/route'
import { POST as codePOST } from './promo-code/route'

function req(body?: unknown, method = 'POST') {
  return new Request('http://x', { method, ...(body ? { body: JSON.stringify(body) } : {}), headers: { Authorization: 'Bearer t' } })
}

beforeEach(() => {
  vi.clearAllMocks()
  requireUser.mockResolvedValue({ uid: 'u1', email: 'ak@x.com' })
  getSettings.mockResolvedValue({ promoDefaultExpiryMonths: 3, minPayoutPaise: 50000 })
  getPartnerConfig.mockResolvedValue({ discountPct: 10, enabled: true })
  listEnrollments.mockResolvedValue([])
  getAppCommission.mockResolvedValue(0)
})

describe('POST /api/influencer/apply', () => {
  it('creates identity only (no auto-enroll)', async () => {
    expect((await applyPOST(req({ socialLinks: ['https://x.com/a'] }))).status).toBe(200)
    expect(applyAsInfluencer).toHaveBeenCalledWith('u1', ['https://x.com/a'], expect.any(Number))
    expect(enroll).not.toHaveBeenCalled()
  })
  it('400 on store validation error', async () => {
    applyAsInfluencer.mockRejectedValue(new Error('provide 1-5 valid social links'))
    const res = await applyPOST(req({ socialLinks: [] }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/link/)
  })
})

describe('POST /api/influencer/enroll', () => {
  it('enrolls into a live app', async () => {
    const res = await enrollPOST(req({ appId: 'crackloop' }))
    expect(res.status).toBe(200)
    expect(enroll).toHaveBeenCalledWith('u1', 'crackloop', expect.any(Number))
  })
  it('400 for unknown app', async () => {
    const res = await enrollPOST(req({ appId: 'nope' }))
    expect(res.status).toBe(400)
    expect(enroll).not.toHaveBeenCalled()
  })
  it('400 when already enrolled', async () => {
    enroll.mockRejectedValue(new Error('already enrolled for this app'))
    const res = await enrollPOST(req({ appId: 'crackloop' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/already/)
  })
})

describe('GET /api/influencer/me', () => {
  it('null profile + available apps for non-member', async () => {
    getInfluencer.mockResolvedValue(null)
    const json = await (await meGET(req(undefined, 'GET'))).json()
    expect(json.profile).toBeNull()
    expect(json.availableApps.map((a: { appId: string }) => a.appId)).toContain('crackloop')
    expect(json.minPayoutPaise).toBe(50000)
  })
  it('returns per-app enrollment with discount, suggestions and aggregate earnings', async () => {
    getInfluencer.mockResolvedValue({ socialLinks: [], appliedAt: 1 })
    listEnrollments.mockResolvedValue([{ appId: 'crackloop', status: 'approved', promoCode: null, commissionRates: { signupPaise: 0, perPlan: {} } }])
    getAppCommission.mockResolvedValue(5000)
    getEarnings.mockResolvedValue({ totalCommissionPaise: 5000, paidPaise: 0, balancePaise: 5000, referrals: [], payouts: [] })
    const json = await (await meGET(req(undefined, 'GET'))).json()
    expect(json.apps).toHaveLength(1)
    expect(json.apps[0]).toMatchObject({ appId: 'crackloop', status: 'approved', discountPct: 10, commissionPaise: 5000 })
    expect(json.apps[0].suggestions).toEqual(['AK10', 'AK25', 'AKVIP'])
    expect(json.earnings.balancePaise).toBe(5000)
    expect(json.availableApps).toHaveLength(0)
  })
})

describe('POST /api/influencer/promo-code', () => {
  it('changes code for the given app using settings expiry', async () => {
    changeAppPromoCode.mockResolvedValue({ code: 'NEW42', expiresAt: 99 })
    const res = await codePOST(req({ appId: 'crackloop', code: 'new42' }))
    expect(res.status).toBe(200)
    // zod normalizes the code (uppercase) before the store call.
    expect(changeAppPromoCode).toHaveBeenCalledWith('u1', 'crackloop', 'NEW42', expect.any(Number), 3)
  })
  it('400 with message on store error', async () => {
    changeAppPromoCode.mockRejectedValue(new Error('code already taken'))
    const res = await codePOST(req({ appId: 'crackloop', code: 'TAKEN1' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/taken/)
  })
})
