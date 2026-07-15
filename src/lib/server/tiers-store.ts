import { STATIC_TIERS, type TierContent } from '@/config/tiers'
import { adminDb } from './firebase-admin'

function staticFallback(appId?: string): TierContent[] {
  return STATIC_TIERS.filter((t) => (appId ? t.appId === appId : true)).sort((a, b) => a.sort - b.sort)
}

export async function getTiersFromDb(appId: string): Promise<TierContent[]> {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return staticFallback(appId)
  try {
    const snap = await adminDb().collection('tiers').where('appId', '==', appId).get()
    if (snap.empty) return staticFallback(appId)
    return snap.docs.map((d) => d.data() as TierContent).sort((a, b) => a.sort - b.sort)
  } catch (err) {
    console.error('tiers query failed, using static fallback', err)
    return staticFallback(appId)
  }
}

export async function listAllTiers(): Promise<TierContent[]> {
  const snap = await adminDb().collection('tiers').get()
  if (snap.empty) return staticFallback()
  return snap.docs.map((d) => d.data() as TierContent).sort((a, b) => a.sort - b.sort)
}

const TIER_ID_RE = /^[a-z0-9-]{2,30}_[a-z0-9-]{2,20}$/

export async function upsertTier(input: Partial<TierContent> & { appId: string; tier: string }): Promise<TierContent> {
  const id = `${input.appId}_${input.tier}`
  if (!TIER_ID_RE.test(id)) throw new Error('appId and tier must be slugs (a-z, 0-9, dashes)')
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 40) {
    throw new Error('title required (max 40 chars)')
  }
  if (typeof input.blurb !== 'string' || input.blurb.length > 160) throw new Error('blurb must be a string (max 160 chars)')
  if (
    !Array.isArray(input.benefits) ||
    input.benefits.length < 1 ||
    input.benefits.length > 8 ||
    !input.benefits.every((b) => typeof b === 'string' && b.trim() && b.length <= 80)
  ) {
    throw new Error('benefits must be 1-8 non-empty strings (max 80 chars each)')
  }
  if (typeof input.offerName !== 'string' || input.offerName.length > 30) throw new Error('offerName must be a string (max 30 chars)')
  if (typeof input.compareLabel !== 'string' || input.compareLabel.length > 30) throw new Error('compareLabel must be a string (max 30 chars)')
  if (typeof input.highlight !== 'boolean') throw new Error('highlight must be boolean')
  if (!Number.isInteger(input.sort)) throw new Error('sort must be an integer')

  const doc: TierContent = {
    id,
    appId: input.appId,
    tier: input.tier,
    title: input.title.trim(),
    blurb: input.blurb.trim(),
    benefits: input.benefits.map((b) => b.trim()),
    offerName: input.offerName.trim(),
    compareLabel: input.compareLabel.trim(),
    highlight: input.highlight,
    sort: input.sort as number,
  }
  await adminDb().doc(`tiers/${id}`).set(doc)
  return doc
}
