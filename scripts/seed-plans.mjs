// Usage: node --env-file=.env.local scripts/seed-plans.mjs
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const STATIC_PLANS = [
  { id: 'crackloop-pro-1m', appId: 'crackloop', tier: 'pro', durationMonths: 1, lifetime: false, pricePaise: 7900, playStorePricePaise: 9900, active: true, sort: 1 },
  { id: 'crackloop-pro-12m', appId: 'crackloop', tier: 'pro', durationMonths: 12, lifetime: false, pricePaise: 79900, playStorePricePaise: 99900, active: true, sort: 2 },
  { id: 'crackloop-pro-life', appId: 'crackloop', tier: 'pro', durationMonths: null, lifetime: true, pricePaise: 199900, playStorePricePaise: null, active: true, sort: 3 },
  { id: 'crackloop-ai-1m', appId: 'crackloop', tier: 'ai', durationMonths: 1, lifetime: false, pricePaise: 15900, playStorePricePaise: 19900, active: true, sort: 4 },
]

const auth = 'Basic ' + Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')

async function createRazorpayPlan(plan) {
  const res = await fetch('https://api.razorpay.com/v1/plans', {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      period: 'monthly',
      interval: plan.durationMonths,
      item: { name: `${plan.appId} ${plan.tier} ${plan.durationMonths}m`, amount: plan.pricePaise, currency: 'INR' },
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`razorpay plan create failed: ${JSON.stringify(json)}`)
  return json.id
}

const app = initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) })
const db = getFirestore(app)

for (const plan of STATIC_PLANS) {
  const ref = db.doc(`plans/${plan.id}`)
  const existing = await ref.get()
  if (existing.exists && existing.data().razorpayPlanId) {
    console.log(`skip ${plan.id} (already seeded: ${existing.data().razorpayPlanId})`)
    continue
  }
  const razorpayPlanId = plan.lifetime ? null : await createRazorpayPlan(plan)
  await ref.set({ ...plan, razorpayPlanId }, { merge: true })
  console.log(`seeded ${plan.id} -> ${razorpayPlanId ?? 'lifetime (no rzp plan)'}`)
}
console.log('done')
