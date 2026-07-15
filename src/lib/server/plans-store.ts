import { STATIC_PLANS, type StoredPlan } from '@/config/plans'
import { adminDb } from './firebase-admin'

function staticFallback(appId?: string): StoredPlan[] {
  return STATIC_PLANS.filter((p) => (appId ? p.appId === appId : true) && p.active)
    .sort((a, b) => a.sort - b.sort)
    .map((p) => ({ ...p, razorpayPlanId: null }))
}

export async function getPlansFromDb(appId: string): Promise<StoredPlan[]> {
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

export async function getPlanById(planId: string): Promise<StoredPlan | null> {
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
