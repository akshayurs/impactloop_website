import { adminDb } from './firebase-admin'

export type GlobalSettings = {
  freeTrialEnabled: boolean
  trialDays: number
  promoDefaultExpiryMonths: number
}

export const DEFAULT_SETTINGS: GlobalSettings = {
  freeTrialEnabled: false,
  trialDays: 7,
  promoDefaultExpiryMonths: 3,
}

export async function getSettings(): Promise<GlobalSettings> {
  const snap = await adminDb().doc('settings/global').get()
  const stored = snap.exists ? (snap.data() as Partial<GlobalSettings>) : {}
  return { ...DEFAULT_SETTINGS, ...stored }
}

export async function updateSettings(patch: Partial<GlobalSettings>): Promise<GlobalSettings> {
  for (const key of Object.keys(patch)) {
    if (!(key in DEFAULT_SETTINGS)) throw new Error(`unknown settings key: ${key}`)
  }
  if (patch.trialDays !== undefined && (!Number.isInteger(patch.trialDays) || patch.trialDays < 1 || patch.trialDays > 365)) {
    throw new Error('trialDays must be an integer between 1 and 365')
  }
  if (
    patch.promoDefaultExpiryMonths !== undefined &&
    (!Number.isInteger(patch.promoDefaultExpiryMonths) || patch.promoDefaultExpiryMonths < 1 || patch.promoDefaultExpiryMonths > 24)
  ) {
    throw new Error('promoDefaultExpiryMonths must be an integer between 1 and 24')
  }
  if (patch.freeTrialEnabled !== undefined && typeof patch.freeTrialEnabled !== 'boolean') {
    throw new Error('freeTrialEnabled must be boolean')
  }
  await adminDb().doc('settings/global').set(patch, { merge: true })
  const current = await getSettings()
  return current
}
