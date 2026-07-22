import { revalidateTag, unstable_cache } from 'next/cache'
import { EMAIL_TOGGLE_DEFAULTS, type EmailToggleKey } from './email/registry'
import { adminDb } from './firebase-admin'

/* Per-email toggles (emailWelcome, …) are sourced from the email registry so a new
   email only needs a registry entry — the type, defaults and validation follow. */
export type GlobalSettings = {
  freeTrialEnabled: boolean
  trialDays: number
  promoDefaultExpiryMonths: number
  emailEnabled: boolean
  emailExpiryReminderDays: number
  minPayoutPaise: number
} & Record<EmailToggleKey, boolean>

export const DEFAULT_SETTINGS: GlobalSettings = {
  freeTrialEnabled: false,
  trialDays: 7,
  promoDefaultExpiryMonths: 3,
  emailEnabled: false,
  emailExpiryReminderDays: 3,
  minPayoutPaise: 50000,
  ...EMAIL_TOGGLE_DEFAULTS,
}

export const SETTINGS_CACHE_TAG = 'settings'

async function readSettings(): Promise<GlobalSettings> {
  const snap = await adminDb().doc('settings/global').get()
  const stored = snap.exists ? (snap.data() as Partial<GlobalSettings>) : {}
  return { ...DEFAULT_SETTINGS, ...stored }
}

// Invalidated by updateSettings; revalidate window is a missed-invalidation safety net.
export const getSettings = unstable_cache(readSettings, ['settings-global'], {
  tags: [SETTINGS_CACHE_TAG],
  revalidate: 3600,
})

const INT_RANGES: Partial<Record<keyof GlobalSettings, [number, number]>> = {
  trialDays: [1, 365],
  promoDefaultExpiryMonths: [1, 24],
  emailExpiryReminderDays: [1, 30],
  minPayoutPaise: [0, 100_000_000],
}

export async function updateSettings(patch: Partial<GlobalSettings>): Promise<GlobalSettings> {
  for (const [key, value] of Object.entries(patch) as [keyof GlobalSettings, unknown][]) {
    if (!(key in DEFAULT_SETTINGS)) throw new Error(`unknown settings key: ${key}`)
    if (value === undefined) continue
    const range = INT_RANGES[key]
    if (range) {
      if (!Number.isInteger(value) || (value as number) < range[0] || (value as number) > range[1]) {
        throw new Error(`${key} must be an integer between ${range[0]} and ${range[1]}`)
      }
    } else if (typeof value !== 'boolean') {
      throw new Error(`${key} must be boolean`)
    }
  }
  await adminDb().doc('settings/global').set(patch, { merge: true })
  revalidateTag(SETTINGS_CACHE_TAG)
  return readSettings()
}
