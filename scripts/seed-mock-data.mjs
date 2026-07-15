// DEV ONLY — seeds fake users/influencers so the admin pages have data to review.
// Usage:  node --env-file=.env.local scripts/seed-mock-data.mjs          (seed)
//         node --env-file=.env.local scripts/seed-mock-data.mjs --clean  (remove all mock data)
// Everything is namespaced: uids start with "mock-", emails end in @mockdata.test.
import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const app = initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) })
const auth = getAuth(app)
const db = getFirestore(app)

const DAY = 86_400_000
const now = Date.now()

const USERS = [
  { n: 1, name: 'Aarav Sharma', plan: 'active-12m' },
  { n: 2, name: 'Diya Patel', plan: 'active-1m' },
  { n: 3, name: 'Vihaan Reddy', plan: 'lifetime' },
  { n: 4, name: 'Ananya Iyer', plan: 'trial' },
  { n: 5, name: 'Arjun Mehta', plan: 'cancelled' },
  { n: 6, name: 'Ishaan Gupta', plan: 'expired' },
  { n: 7, name: 'Sara Khan', plan: 'active-ai' },
  { n: 8, name: 'Kabir Singh', plan: 'none' },
  { n: 9, name: 'Myra Nair', plan: 'none' },
  { n: 10, name: 'Advait Joshi', plan: 'active-12m' },
  { n: 11, name: 'Zara Ahmed', plan: 'trial' },
  { n: 12, name: 'Rohan Verma', plan: 'none' },
]

const INFLUENCERS = [
  { n: 1, name: 'Neha Codes', status: 'approved', code: 'NEHA10', referrals: 6, payout: true },
  { n: 2, name: 'DSA Guru', status: 'approved', code: 'DSAGURU25', referrals: 3, payout: false },
  { n: 3, name: 'Tech Tanvi', status: 'approved', code: 'TANVI10', referrals: 0, payout: false },
  { n: 4, name: 'Prep With Raj', status: 'pending', code: null, referrals: 0, payout: false },
  { n: 5, name: 'Interview Didi', status: 'pending', code: null, referrals: 0, payout: false },
  { n: 6, name: 'Spam Account', status: 'rejected', code: null, referrals: 0, payout: false },
]

const uidUser = (n) => `mock-user-${String(n).padStart(2, '0')}`
const uidInf = (n) => `mock-inf-${String(n).padStart(2, '0')}`
const emailFor = (name, kind, n) =>
  `${name.toLowerCase().replace(/[^a-z]/g, '.')}.${kind}${n}@mockdata.test`

function grants(tier) {
  return tier ? { adFree: true, unlimitedAi: tier === 'ai', tier } : { adFree: false, unlimitedAi: false, tier: null }
}

function entitlementFor(plan, n) {
  const boughtAt = now - (20 + n * 3) * DAY
  switch (plan) {
    case 'active-12m':
      return {
        doc: {
          subscription: { status: 'active', planId: 'crackloop-pro-12m', tier: 'pro', expiryTimeMillis: boughtAt + 365 * DAY, autoRenewing: true, razorpaySubscriptionId: `sub_mock${n}`, source: 'web', lastVerifiedAt: now - n * DAY },
          entitlements: grants('pro'),
        },
        payments: [{ amountPaise: 79900, planId: 'crackloop-pro-12m', type: 'subscription', createdAt: boughtAt }],
      }
    case 'active-1m':
      return {
        doc: {
          subscription: { status: 'active', planId: 'crackloop-pro-1m', tier: 'pro', expiryTimeMillis: now + 12 * DAY, autoRenewing: true, razorpaySubscriptionId: `sub_mock${n}`, source: 'web', lastVerifiedAt: now - DAY },
          entitlements: grants('pro'),
        },
        payments: [
          { amountPaise: 7900, planId: 'crackloop-pro-1m', type: 'subscription', createdAt: boughtAt },
          { amountPaise: 7900, planId: 'crackloop-pro-1m', type: 'subscription', createdAt: boughtAt + 30 * DAY },
        ],
      }
    case 'active-ai':
      return {
        doc: {
          subscription: { status: 'active', planId: 'crackloop-ai-1m', tier: 'ai', expiryTimeMillis: now + 20 * DAY, autoRenewing: true, razorpaySubscriptionId: `sub_mock${n}`, source: 'web', lastVerifiedAt: now - 2 * DAY },
          entitlements: grants('ai'),
        },
        payments: [{ amountPaise: 15900, planId: 'crackloop-ai-1m', type: 'subscription', createdAt: boughtAt }],
      }
    case 'lifetime':
      return {
        doc: {
          subscription: { status: 'lifetime', planId: 'crackloop-pro-life', tier: 'pro', expiryTimeMillis: null, autoRenewing: false, razorpaySubscriptionId: null, source: 'web', lastVerifiedAt: boughtAt },
          entitlements: grants('pro'),
        },
        payments: [{ amountPaise: 199900, planId: 'crackloop-pro-life', type: 'lifetime', createdAt: boughtAt }],
      }
    case 'trial':
      return {
        doc: {
          subscription: { status: 'trial', planId: 'trial', tier: 'pro', expiryTimeMillis: now + 5 * DAY, autoRenewing: false, razorpaySubscriptionId: null, source: 'web', lastVerifiedAt: now - DAY },
          entitlements: grants('pro'),
          trialUsed: true,
        },
        payments: [],
      }
    case 'cancelled':
      return {
        doc: {
          subscription: { status: 'cancelled', planId: 'crackloop-pro-1m', tier: 'pro', expiryTimeMillis: now + 9 * DAY, autoRenewing: false, razorpaySubscriptionId: `sub_mock${n}`, source: 'web', lastVerifiedAt: now - 3 * DAY },
          entitlements: grants('pro'),
        },
        payments: [{ amountPaise: 7900, planId: 'crackloop-pro-1m', type: 'subscription', createdAt: boughtAt }],
      }
    case 'expired':
      return {
        doc: {
          subscription: { status: 'expired', planId: 'crackloop-pro-1m', tier: 'pro', expiryTimeMillis: now - 15 * DAY, autoRenewing: false, razorpaySubscriptionId: `sub_mock${n}`, source: 'web', lastVerifiedAt: now - 15 * DAY },
          entitlements: grants(null),
        },
        payments: [{ amountPaise: 7900, planId: 'crackloop-pro-1m', type: 'subscription', createdAt: boughtAt }],
      }
    default:
      return { doc: null, payments: [] }
  }
}

async function ensureAuthUser(uid, name, email) {
  try {
    await auth.getUser(uid)
  } catch {
    await auth.createUser({ uid, email, displayName: name, emailVerified: true })
  }
}

async function seed() {
  for (const u of USERS) {
    const uid = uidUser(u.n)
    await ensureAuthUser(uid, u.name, emailFor(u.name, 'user', u.n))
    const { doc, payments } = entitlementFor(u.plan, u.n)
    if (doc) await db.doc(`users/${uid}/apps/crackloop`).set(doc)
    for (const [i, p] of payments.entries()) {
      await db.doc(`users/${uid}/payments/pay-mock-${u.n}-${i}`).set({ ...p, appId: 'crackloop' })
    }
    console.log(`user ${uid} (${u.plan})`)
  }

  for (const inf of INFLUENCERS) {
    const uid = uidInf(inf.n)
    await ensureAuthUser(uid, inf.name, emailFor(inf.name, 'inf', inf.n))
    const appliedAt = now - (40 + inf.n * 5) * DAY
    await db.doc(`influencers/${uid}`).set({
      status: inf.status,
      socialLinks: [`https://instagram.com/${inf.name.toLowerCase().replace(/[^a-z]/g, '')}`, `https://youtube.com/@${inf.name.toLowerCase().replace(/[^a-z]/g, '')}`],
      appliedAt,
      decidedAt: inf.status === 'pending' ? null : appliedAt + 2 * DAY,
      discountPct: 10,
      commissionRates: inf.status === 'approved' ? { signupPaise: 0, perPlan: { 'crackloop-pro-1m': 1500, 'crackloop-pro-12m': 12000, 'crackloop-pro-life': 30000, 'crackloop-ai-1m': 3000 } } : { signupPaise: 0, perPlan: {} },
      promoCode: inf.code,
    })
    if (inf.code) {
      await db.doc(`promoCodes/${inf.code}`).set({ code: inf.code, ownerUid: uid, active: true, createdAt: appliedAt + 3 * DAY, expiresAt: now + 90 * DAY })
    }
    let earned = 0
    for (let r = 0; r < inf.referrals; r++) {
      const planIds = ['crackloop-pro-1m', 'crackloop-pro-12m', 'crackloop-pro-life']
      const planId = planIds[r % planIds.length]
      const commission = { 'crackloop-pro-1m': 1500, 'crackloop-pro-12m': 12000, 'crackloop-pro-life': 30000 }[planId]
      earned += commission
      await db.doc(`referrals/pay-mock-${inf.n}-${r}`).set({
        code: inf.code,
        ownerUid: uid,
        referredUid: uidUser(((r + inf.n) % USERS.length) + 1),
        type: planId.endsWith('life') ? 'lifetime' : 'subscription',
        planId,
        commissionPaise: commission,
        createdAt: now - (30 - r * 4) * DAY,
      })
    }
    if (inf.payout && earned > 0) {
      const amount = Math.floor(earned / 2)
      await db.doc(`payouts/${uid}-${now}`).set({ influencerUid: uid, amountPaise: amount, note: 'Mock payout (UPI)', paidAt: now - 10 * DAY })
    }
    console.log(`influencer ${uid} (${inf.status}${inf.code ? ` · ${inf.code}` : ''}${inf.referrals ? ` · ${inf.referrals} referrals` : ''})`)
  }
  console.log('seed done')
}

async function clean() {
  const uids = [...USERS.map((u) => uidUser(u.n)), ...INFLUENCERS.map((i) => uidInf(i.n))]
  for (const uid of uids) {
    await auth.deleteUser(uid).catch(() => {})
    await db.recursiveDelete(db.doc(`users/${uid}`)).catch(() => {})
    await db.doc(`influencers/${uid}`).delete().catch(() => {})
  }
  for (const inf of INFLUENCERS) {
    if (inf.code) await db.doc(`promoCodes/${inf.code}`).delete().catch(() => {})
  }
  for (const inf of INFLUENCERS) {
    const uid = uidInf(inf.n)
    const refs = await db.collection('referrals').where('ownerUid', '==', uid).get()
    for (const d of refs.docs) await d.ref.delete()
    const pays = await db.collection('payouts').where('influencerUid', '==', uid).get()
    for (const d of pays.docs) await d.ref.delete()
  }
  console.log('mock data removed')
}

if (process.argv.includes('--clean')) await clean()
else await seed()
