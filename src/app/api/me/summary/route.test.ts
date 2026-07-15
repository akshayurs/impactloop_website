import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireUser, listDocuments, paymentsGet } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  listDocuments: vi.fn(),
  paymentsGet: vi.fn(),
}))

vi.mock('@/lib/server/verify-token', () => ({ requireUser, UnauthorizedError: class extends Error { status = 401 } }))
vi.mock('@/lib/server/firebase-admin', () => ({
  adminDb: () => ({
    collection: (path: string) =>
      path.endsWith('/payments')
        ? { orderBy: () => ({ orderBy: () => ({ limit: () => ({ get: paymentsGet }) }) }) }
        : { listDocuments },
  }),
}))

import { GET } from './route'

describe('GET /api/me/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireUser.mockResolvedValue({ uid: 'u1', email: null })
    listDocuments.mockResolvedValue([
      { id: 'crackloop', get: async () => ({ exists: true, data: () => ({ subscription: { status: 'active' }, entitlements: { adFree: true, unlimitedAi: false } }) }) },
    ])
    paymentsGet.mockResolvedValue({ docs: [{ id: 'pay_1', data: () => ({ amountPaise: 7900, planId: 'p', appId: 'crackloop', type: 'subscription', createdAt: 5 }) }] })
  })

  it('returns own apps and payments', async () => {
    const res = await GET(new Request('http://x', { headers: { Authorization: 'Bearer t' } }))
    const json = await res.json()
    expect(json.apps).toEqual([{ appId: 'crackloop', subscription: { status: 'active' }, entitlements: { adFree: true, unlimitedAi: false } }])
    expect(json.payments).toEqual([{ id: 'pay_1', amountPaise: 7900, planId: 'p', appId: 'crackloop', type: 'subscription', createdAt: 5 }])
  })

  it('401 when unauthenticated', async () => {
    const { UnauthorizedError } = await import('@/lib/server/verify-token')
    requireUser.mockRejectedValue(new UnauthorizedError('no'))
    expect((await GET(new Request('http://x'))).status).toBe(401)
  })
})
