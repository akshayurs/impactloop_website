import type { User } from 'firebase/auth'
import type { Role } from './use-role'

/** Dev-only role mock. Inert unless NEXT_PUBLIC_MOCK_ROLE is set (see launch.json). */
export const MOCK_ROLE = (process.env.NEXT_PUBLIC_MOCK_ROLE as Role | undefined) ?? null

const mockUserBase = {
  uid: 'mock-influencer-uid',
  displayName: 'Aditi Sharma',
  email: 'aditi.creates@gmail.com',
  photoURL: null,
  getIdToken: async () => 'mock-token',
  getIdTokenResult: async () => ({ token: 'mock-token', claims: { admin: MOCK_ROLE === 'admin' } }),
}

export const mockUser = MOCK_ROLE ? (mockUserBase as unknown as User) : null

const day = 86_400_000
const now = 1_752_624_000_000 // fixed reference so demo data is stable

let mockPayoutRequested = false
let mockPayoutUpi = ''
let mockPromoCode = 'ADITI15'

const mockInfluencerMe = () => ({
  minPayoutPaise: 50000,
  profile: { socialLinks: ['https://instagram.com/aditi.creates', 'https://youtube.com/@aditicreates'], appliedAt: now - 60 * day },
  apps: [
    {
      appId: 'crackloop',
      name: 'CrackLoop',
      status: 'approved',
      promoCode: mockPromoCode,
      discountPct: 15,
      commissionRates: { signupPaise: 2000, perPlan: { 'crackloop-pro-1m': 1500, 'crackloop-ai-1m': 2500 } },
      commissionPaise: 184000,
      suggestions: [],
    },
  ],
  availableApps: [],
  earnings: {
    totalCommissionPaise: 184000,
    paidPaise: 120000,
    balancePaise: 64000,
    referrals: [
      { id: 'r1', appId: 'crackloop', type: 'lifetime', planId: 'crackloop-ai-1m', commissionPaise: 25000, createdAt: now - 2 * day },
      { id: 'r2', appId: 'crackloop', type: 'subscription', planId: 'crackloop-pro-1m', commissionPaise: 15000, createdAt: now - 5 * day },
      { id: 'r3', appId: 'crackloop', type: 'subscription', planId: 'crackloop-pro-1m', commissionPaise: 15000, createdAt: now - 9 * day },
      { id: 'r4', appId: 'crackloop', type: 'signup', planId: null, commissionPaise: 2000, createdAt: now - 12 * day },
      { id: 'r5', appId: 'crackloop', type: 'lifetime', planId: 'crackloop-ai-1m', commissionPaise: 25000, createdAt: now - 18 * day },
    ],
    payouts: [
      { id: 'p1', amountPaise: 80000, note: 'UPI · June payout', paidAt: now - 20 * day },
      { id: 'p2', amountPaise: 40000, note: 'UPI · May payout', paidAt: now - 50 * day },
    ],
    referralsCursor: null,
    payoutsCursor: null,
    payoutRequest: mockPayoutRequested ? { amountPaise: 64000, requestedAt: now, upiId: mockPayoutUpi } : null,
  },
})

let mockAdminDiscountPct = 10

const MOCK_ADMIN_ENROLLMENTS = [
  {
    uid: 'inf-aditi', email: 'aditi.creates@gmail.com', appId: 'crackloop', status: 'approved',
    appliedAt: now - 60 * day, promoCode: 'ADITI15',
    commissionRates: { signupPaise: 2000, perPlan: { 'crackloop-pro-1m': 1500, 'crackloop-ai-1m': 2500 } },
  },
  {
    uid: 'inf-rohan', email: 'rohan.codes@gmail.com', appId: 'crackloop', status: 'pending',
    appliedAt: now - 3 * day, promoCode: null, commissionRates: { signupPaise: 0, perPlan: {} },
  },
]

const MOCK_ADMIN_PLANS = [
  { id: 'crackloop-pro-1m', appId: 'crackloop', tier: 'pro', active: true },
  { id: 'crackloop-ai-1m', appId: 'crackloop', tier: 'ai', active: true },
]

function adminMock(path: string, init: RequestInit | undefined, json: (d: unknown) => Response): Response | null {
  if (path.startsWith('/api/admin/settings')) return json({ minPayoutPaise: 50000, emailEnabled: false })
  if (path.startsWith('/api/admin/plans')) return json({ plans: MOCK_ADMIN_PLANS })
  if (path.startsWith('/api/admin/partner-config')) {
    if (init?.method === 'PUT') {
      try {
        const b = JSON.parse(String(init.body ?? '{}'))
        if (typeof b.discountPct === 'number') mockAdminDiscountPct = b.discountPct
      } catch {
        /* ignore */
      }
    }
    return json({ appId: 'crackloop', config: { discountPct: mockAdminDiscountPct, enabled: true } })
  }
  if (/\/api\/admin\/influencers\/[^/?]+$/.test(path.split('?')[0])) {
    const action = (() => {
      try {
        return JSON.parse(String(init?.body ?? '{}')).action
      } catch {
        return null
      }
    })()
    if (action === 'earnings') return json({ totalCommissionPaise: 184000, paidPaise: 120000, balancePaise: 64000, referrals: [], payouts: [], payoutRequest: null })
    return json({ ok: true })
  }
  if (path.startsWith('/api/admin/influencers')) {
    return json({ influencers: MOCK_ADMIN_ENROLLMENTS.map((e) => ({ ...e, discountPct: mockAdminDiscountPct })), nextCursor: null })
  }
  return null
}

/** Returns a canned Response for known paths when mocking, else null so real fetch runs. */
export function mockResponse(path: string, init?: RequestInit): Response | null {
  if (!MOCK_ROLE) return null
  const json = (data: unknown) =>
    new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
  if (MOCK_ROLE === 'admin') return adminMock(path, init, json)
  if (path.startsWith('/api/influencer/enroll')) return json({ ok: true })
  if (path.startsWith('/api/influencer/promo-code')) {
    try {
      const code = String(JSON.parse(String(init?.body ?? '{}')).code ?? '').toUpperCase()
      if (code) mockPromoCode = code
    } catch {
      /* ignore */
    }
    return json({ code: mockPromoCode, expiresAt: now })
  }
  if (path.startsWith('/api/influencer/payout-request')) {
    const upiId = (() => {
      try {
        return String(JSON.parse(String(init?.body ?? '{}')).upiId ?? '')
      } catch {
        return ''
      }
    })()
    mockPayoutRequested = true
    mockPayoutUpi = upiId
    return json({ ok: true, request: { amountPaise: 64000, requestedAt: now, upiId } })
  }
  if (path.startsWith('/api/influencer/me')) return json(mockInfluencerMe())
  return null
}
