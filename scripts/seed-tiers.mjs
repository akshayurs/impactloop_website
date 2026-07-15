// Usage: node --env-file=.env.local scripts/seed-tiers.mjs
// Seeds pricing tier-card content (title/blurb/benefits/offer badge) — skips existing docs.
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const STATIC_TIERS = [
  {
    id: 'crackloop_pro',
    appId: 'crackloop',
    tier: 'pro',
    title: 'Pro',
    blurb: 'The full learning experience, ad-free.',
    benefits: [
      'All concept decks unlocked',
      'Quizzes, mock exams & review deck',
      'Streaks, badges & leaderboards',
      'Completely ad-free',
    ],
    offerName: 'Most popular',
    compareLabel: 'vs Google Play',
    highlight: true,
    sort: 1,
  },
  {
    id: 'crackloop_ai',
    appId: 'crackloop',
    tier: 'ai',
    title: 'AI',
    blurb: 'Unlimited AI tutoring on top of everything.',
    benefits: [
      'Unlimited AI tutor chat',
      'Voice chat & mock interviews',
      'Instant explanations mid-topic',
      'Metered fairly, cancel anytime',
    ],
    offerName: '',
    compareLabel: 'vs Google Play',
    highlight: false,
    sort: 2,
  },
]

const app = initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) })
const db = getFirestore(app)

for (const t of STATIC_TIERS) {
  const ref = db.doc(`tiers/${t.id}`)
  const existing = await ref.get()
  if (existing.exists) {
    console.log(`skip ${t.id} (exists)`)
    continue
  }
  await ref.set(t)
  console.log(`seeded ${t.id}`)
}
console.log('done')
