import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireUser, applyAsInfluencer, getInfluencer, getEarnings, suggestCodes, changePromoCode, getSettings } = vi.hoisted(() => ({
  requireUser: vi.fn(), applyAsInfluencer: vi.fn(), getInfluencer: vi.fn(), getEarnings: vi.fn(),
  suggestCodes: vi.fn(), changePromoCode: vi.fn(), getSettings: vi.fn(),
}))
vi.mock('@/lib/server/verify-token', () => ({ requireUser, UnauthorizedError: class extends Error { status = 401 } }))
vi.mock('@/lib/server/influencer', () => ({ applyAsInfluencer, getInfluencer, getEarnings, suggestCodes, changePromoCode }))
vi.mock('@/lib/server/settings', () => ({ getSettings }))

import { POST as applyPOST } from './apply/route'
import { GET as meGET } from './me/route'
import { POST as codePOST } from './promo-code/route'

function req(body?: unknown, method = 'POST') {
  return new Request('http://x', { method, ...(body ? { body: JSON.stringify(body) } : {}), headers: { Authorization: 'Bearer t' } })
}

beforeEach(() => {
  vi.clearAllMocks()
  requireUser.mockResolvedValue({ uid: 'u1', email: 'ak@x.com' })
  getSettings.mockResolvedValue({ freeTrialEnabled: false, trialDays: 7, promoDefaultExpiryMonths: 3 })
})

describe('POST /api/influencer/apply', () => {
  it('401 unauth', async () => {
    const { UnauthorizedError } = await import('@/lib/server/verify-token')
    requireUser.mockRejectedValue(new UnauthorizedError('no'))
    expect((await applyPOST(req({ socialLinks: [] }))).status).toBe(401)
  })
  it('applies and 400s on store validation error', async () => {
    expect((await applyPOST(req({ socialLinks: ['https://x.com/a'] }))).status).toBe(200)
    expect(applyAsInfluencer).toHaveBeenCalledWith('u1', ['https://x.com/a'], expect.any(Number))
    applyAsInfluencer.mockRejectedValue(new Error('application already exists'))
    const res = await applyPOST(req({ socialLinks: ['https://x.com/a'] }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/already/)
  })
})

describe('GET /api/influencer/me', () => {
  it('null influencer for non-applicant', async () => {
    getInfluencer.mockResolvedValue(null)
    const res = await meGET(req(undefined, 'GET'))
    expect(await res.json()).toEqual({ influencer: null, suggestions: [], earnings: null })
  })
  it('approved gets earnings + suggestions when no code', async () => {
    getInfluencer.mockResolvedValue({ status: 'approved', promoCode: null })
    getEarnings.mockResolvedValue({ totalCommissionPaise: 0, paidPaise: 0, balancePaise: 0, referrals: [], payouts: [] })
    suggestCodes.mockReturnValue(['AK10', 'AK25', 'AKVIP'])
    const json = await (await meGET(req(undefined, 'GET'))).json()
    expect(json.suggestions).toEqual(['AK10', 'AK25', 'AKVIP'])
    expect(json.earnings.balancePaise).toBe(0)
    expect(suggestCodes).toHaveBeenCalledWith('ak', 'u1')
  })
})

describe('POST /api/influencer/promo-code', () => {
  it('changes code using settings expiry', async () => {
    changePromoCode.mockResolvedValue({ code: 'NEW42', expiresAt: 99 })
    const res = await codePOST(req({ code: 'new42' }))
    expect(res.status).toBe(200)
    expect(changePromoCode).toHaveBeenCalledWith('u1', 'new42', expect.any(Number), 3)
  })
  it('400 with message on store error', async () => {
    changePromoCode.mockRejectedValue(new Error('code already taken'))
    const res = await codePOST(req({ code: 'TAKEN1' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/taken/)
  })
})
