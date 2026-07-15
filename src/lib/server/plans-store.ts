import { unstable_cache } from 'next/cache'
import { STATIC_PLANS, type StoredPlan } from '@/config/plans'
import { adminDb } from './firebase-admin'

export const PLANS_CACHE_TAG = 'plans'

function staticFallback(appId?: string): StoredPlan[] {
  return STATIC_PLANS.filter((p) => (appId ? p.appId === appId : true) && p.active)
    .sort((a, b) => a.sort - b.sort)
    .map((p) => ({ ...p, razorpayPlanId: null }))
}

async function readPlansFromDb(appId: string): Promise<StoredPlan[]> {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return staticFallback(appId)
  try {
    const snap = await adminDb()
      .collection('plans')
      .where('appId', '==', appId)
      .where('active', '==', true)
      .orderBy('sort')
      .get()
    return snap.docs.map((d) => d.data() as StoredPlan)
  } catch (err) {
    console.error('plans query failed, using static fallback', err)
    return staticFallback(appId)
  }
}

async function readPlanById(planId: string): Promise<StoredPlan | null> {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    return staticFallback().find((p) => p.id === planId) ?? null
  }
  try {
    const snap = await adminDb().doc(`plans/${planId}`).get()
    return snap.exists ? (snap.data() as StoredPlan) : null
  } catch (err) {
    console.error('plan lookup failed, using static fallback', err)
    return staticFallback().find((p) => p.id === planId) ?? null
  }
}

// Plans change only on admin edits, which call revalidateTag(PLANS_CACHE_TAG).
// The revalidate window is a safety net for any missed invalidation.
export const getPlansFromDb = unstable_cache(readPlansFromDb, ['plans-by-app'], {
  tags: [PLANS_CACHE_TAG],
  revalidate: 3600,
})

export const getPlanById = unstable_cache(readPlanById, ['plan-by-id'], {
  tags: [PLANS_CACHE_TAG],
  revalidate: 3600,
})
