import { revalidateTag, unstable_cache } from 'next/cache'
import { adminDb } from './firebase-admin'

/** Per-app partner settings. `discountPct` is the discount every approved code for the app grants. */
export type PartnerConfig = {
  discountPct: number
  enabled: boolean
}

export const DEFAULT_PARTNER_CONFIG: PartnerConfig = { discountPct: 10, enabled: true }

export const PARTNER_CONFIG_CACHE_TAG = 'partner-config'

async function readPartnerConfig(appId: string): Promise<PartnerConfig> {
  const snap = await adminDb().doc(`partnerConfig/${appId}`).get()
  const stored = snap.exists ? (snap.data() as Partial<PartnerConfig>) : {}
  return { ...DEFAULT_PARTNER_CONFIG, ...stored }
}

// Invalidated by updatePartnerConfig; revalidate window is a missed-invalidation safety net.
export const getPartnerConfig = unstable_cache(readPartnerConfig, ['partner-config-by-app'], {
  tags: [PARTNER_CONFIG_CACHE_TAG],
  revalidate: 3600,
})

export async function updatePartnerConfig(appId: string, patch: Partial<PartnerConfig>): Promise<PartnerConfig> {
  const clean: Partial<PartnerConfig> = {}
  if (patch.discountPct !== undefined) {
    if (!Number.isInteger(patch.discountPct) || patch.discountPct < 0 || patch.discountPct > 90) {
      throw new Error('discountPct must be an integer between 0 and 90')
    }
    clean.discountPct = patch.discountPct
  }
  if (patch.enabled !== undefined) {
    if (typeof patch.enabled !== 'boolean') throw new Error('enabled must be boolean')
    clean.enabled = patch.enabled
  }
  if (Object.keys(clean).length === 0) throw new Error('empty partner config patch')
  await adminDb().doc(`partnerConfig/${appId}`).set(clean, { merge: true })
  revalidateTag(PARTNER_CONFIG_CACHE_TAG)
  return readPartnerConfig(appId)
}
