import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireAdmin, getMetrics, listUsers, getUserDetail, grantTrial, revokeEntitlement, getSettings, updateSettings, createPlanWithRazorpay, updatePlanFields, listWebhookEvents, plansGet } = vi.hoisted(() => ({
  requireAdmin: vi.fn(), getMetrics: vi.fn(), listUsers: vi.fn(), getUserDetail: vi.fn(),
  grantTrial: vi.fn(), revokeEntitlement: vi.fn(), getSettings: vi.fn(), updateSettings: vi.fn(),
  createPlanWithRazorpay: vi.fn(), updatePlanFields: vi.fn(), listWebhookEvents: vi.fn(), plansGet: vi.fn(),
}))
vi.mock('@/lib/server/require-admin', () => ({
  requireAdmin,
  ForbiddenError: class extends Error { status = 403 },
}))
vi.mock('@/lib/server/verify-token', () => ({ UnauthorizedError: class extends Error { status = 401 } }))
vi.mock('@/lib/server/admin-data', () => ({ getMetrics, listUsers, getUserDetail, revokeEntitlement, createPlanWithRazorpay, updatePlanFields, listWebhookEvents }))
vi.mock('@/lib/server/trial', () => ({ grantTrial }))
vi.mock('@/lib/server/settings', () => ({ getSettings, updateSettings }))
vi.mock('@/lib/server/firebase-admin', () => ({
  adminDb: () => ({ collection: () => ({ orderBy: () => ({ get: plansGet }) }) }),
}))

import { GET as metricsGET } from './metrics/route'
import { GET as usersGET } from './users/route'
import { GET as userGET, POST as userPOST } from './users/[uid]/route'
import { GET as plansGET, POST as plansPOST } from './plans/route'
import { PATCH as planPATCH } from './plans/[planId]/route'
import { GET as settingsGET, PUT as settingsPUT } from './settings/route'
import { GET as webhooksGET } from './webhooks/route'

const authed = { headers: { Authorization: 'Bearer t' } }

describe('admin guard matrix', () => {
  beforeEach(() => vi.clearAllMocks())

  it('401 when unauthenticated', async () => {
    const { UnauthorizedError } = await import('@/lib/server/verify-token')
    requireAdmin.mockRejectedValue(new UnauthorizedError('no'))
    expect((await metricsGET(new Request('http://x'))).status).toBe(401)
  })

  it('403 when not admin', async () => {
    const { ForbiddenError } = await import('@/lib/server/require-admin')
    requireAdmin.mockRejectedValue(new ForbiddenError('no'))
    expect((await metricsGET(new Request('http://x', authed))).status).toBe(403)
  })
})

describe('admin handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdmin.mockResolvedValue({ uid: 'admin', email: 'a@b.c' })
  })

  it('metrics returns data', async () => {
    getMetrics.mockResolvedValue({ totalRevenuePaise: 100 })
    const res = await metricsGET(new Request('http://x', authed))
    expect((await res.json()).totalRevenuePaise).toBe(100)
  })

  it('users list passes q', async () => {
    listUsers.mockResolvedValue([])
    await usersGET(new Request('http://x/api/admin/users?q=alice', authed))
    expect(listUsers).toHaveBeenCalledWith('alice')
  })

  it('user detail by uid', async () => {
    getUserDetail.mockResolvedValue({ profile: null, apps: [], payments: [] })
    const res = await userGET(new Request('http://x', authed), { params: Promise.resolve({ uid: 'u9' }) })
    expect(getUserDetail).toHaveBeenCalledWith('u9')
    expect(res.status).toBe(200)
  })

  it('user action grant-trial with explicit days', async () => {
    const res = await userPOST(
      new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'grant-trial', appId: 'crackloop', trialDays: 30 }) }),
      { params: Promise.resolve({ uid: 'u9' }) },
    )
    expect(res.status).toBe(200)
    expect(grantTrial).toHaveBeenCalledWith('u9', 'crackloop', 30, expect.any(Number))
  })

  it('user action revoke', async () => {
    await userPOST(
      new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'revoke', appId: 'crackloop' }) }),
      { params: Promise.resolve({ uid: 'u9' }) },
    )
    expect(revokeEntitlement).toHaveBeenCalledWith('u9', 'crackloop')
  })

  it('unknown action 400', async () => {
    const res = await userPOST(
      new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ action: 'nuke', appId: 'crackloop' }) }),
      { params: Promise.resolve({ uid: 'u9' }) },
    )
    expect(res.status).toBe(400)
  })

  it('plans GET lists all incl inactive', async () => {
    plansGet.mockResolvedValue({ docs: [{ data: () => ({ id: 'p1', active: false }) }] })
    const res = await plansGET(new Request('http://x', authed))
    expect((await res.json()).plans).toEqual([{ id: 'p1', active: false }])
  })

  it('plans POST validation error -> 400 with message', async () => {
    createPlanWithRazorpay.mockRejectedValue(new Error('id must be a slug'))
    const res = await plansPOST(new Request('http://x', { ...authed, method: 'POST', body: JSON.stringify({ id: 'X' }) }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/slug/)
  })

  it('plan PATCH forwards patch', async () => {
    await planPATCH(
      new Request('http://x', { ...authed, method: 'PATCH', body: JSON.stringify({ active: false }) }),
      { params: Promise.resolve({ planId: 'p1' }) },
    )
    expect(updatePlanFields).toHaveBeenCalledWith('p1', { active: false })
  })

  it('settings GET + PUT', async () => {
    getSettings.mockResolvedValue({ freeTrialEnabled: false, trialDays: 7, promoDefaultExpiryMonths: 3 })
    expect((await settingsGET(new Request('http://x', authed))).status).toBe(200)
    updateSettings.mockResolvedValue({ freeTrialEnabled: true, trialDays: 7, promoDefaultExpiryMonths: 3 })
    const res = await settingsPUT(new Request('http://x', { ...authed, method: 'PUT', body: JSON.stringify({ freeTrialEnabled: true }) }))
    expect(updateSettings).toHaveBeenCalledWith({ freeTrialEnabled: true })
    expect(res.status).toBe(200)
  })

  it('webhooks GET', async () => {
    listWebhookEvents.mockResolvedValue([{ id: 'e1', event: 'x', receivedAt: 1 }])
    const res = await webhooksGET(new Request('http://x', authed))
    expect((await res.json()).events).toHaveLength(1)
  })
})
