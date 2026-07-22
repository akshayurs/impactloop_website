import { beforeEach, describe, expect, it, vi } from 'vitest'

const { docGet, recordReferral, getEnrollment, notifyCommission } = vi.hoisted(() => ({
  docGet: vi.fn(),
  recordReferral: vi.fn(),
  getEnrollment: vi.fn(),
  notifyCommission: vi.fn(),
}))

vi.mock('./influencer', () => ({ recordReferral }))
vi.mock('./influencer-apps', () => ({ getEnrollment }))
vi.mock('./email/notify', () => ({ notifyCommission }))
vi.mock('./firebase-admin', () => ({
  adminDb: () => ({ doc: (path: string) => ({ get: () => docGet(path) }) }),
}))

import { creditSignupCommission } from './commission'

beforeEach(() => {
  vi.clearAllMocks()
  recordReferral.mockResolvedValue(true)
  getEnrollment.mockResolvedValue({ status: 'approved', commissionRates: { signupPaise: 500, perPlan: {} } })
})

describe('creditSignupCommission', () => {
  it('does nothing when the user has no referral attribution', async () => {
    docGet.mockResolvedValue({ exists: false, data: () => undefined })
    await creditSignupCommission('u2', 1)
    expect(recordReferral).not.toHaveBeenCalled()
  })

  it('credits the referring partner once the referred user pays', async () => {
    docGet.mockResolvedValue({
      exists: true,
      data: () => ({ referredBy: 'AK10X', referredByOwnerUid: 'inf1', referredByAppId: 'crackloop' }),
    })
    await creditSignupCommission('u2', 42)
    expect(recordReferral).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'signup-u2', type: 'signup', ownerUid: 'inf1', appId: 'crackloop', commissionPaise: 500 }),
    )
    expect(notifyCommission).toHaveBeenCalledWith(expect.objectContaining({ ownerUid: 'inf1', commissionPaise: 500 }))
  })

  it('credits nothing when the signup rate is zero', async () => {
    docGet.mockResolvedValue({
      exists: true,
      data: () => ({ referredBy: 'AK10X', referredByOwnerUid: 'inf1', referredByAppId: 'crackloop' }),
    })
    getEnrollment.mockResolvedValue({ status: 'approved', commissionRates: { signupPaise: 0, perPlan: {} } })
    await creditSignupCommission('u2', 1)
    expect(recordReferral).not.toHaveBeenCalled()
  })

  it('resolves owner/app from the promo code for legacy attribution', async () => {
    docGet.mockImplementation(async (path: string) => {
      if (path === 'users/u2') return { exists: true, data: () => ({ referredBy: 'AK10X' }) }
      if (path === 'promoCodes/AK10X') return { exists: true, data: () => ({ ownerUid: 'inf1', appId: 'crackloop' }) }
      return { exists: false, data: () => undefined }
    })
    await creditSignupCommission('u2', 1)
    expect(recordReferral).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'signup-u2', ownerUid: 'inf1', appId: 'crackloop', commissionPaise: 500 }),
    )
  })

  it('skips self-referral', async () => {
    docGet.mockResolvedValue({
      exists: true,
      data: () => ({ referredBy: 'AK10X', referredByOwnerUid: 'u2', referredByAppId: 'crackloop' }),
    })
    await creditSignupCommission('u2', 1)
    expect(recordReferral).not.toHaveBeenCalled()
  })
})
