export type AppRegistryEntry = {
  appId: string
  displayName: string
  contentRepo: string
  playProductIds: { pro: string; ai: string }
  razorpayPlanIds: { pro: string | null; ai: string | null }
  theme: { primary: string; accent: string }
}

// Synced by hand from StudyAppTemplate/app/assets/flavors/*.json — see docs/registry-sync.md.
export const APPS: Record<string, AppRegistryEntry> = {
  crackloop: {
    appId: 'crackloop',
    displayName: 'CrackLoop',
    contentRepo: 'akshayurs/CrackLoopData',
    playProductIds: { pro: 'pro_monthly', ai: 'ai_monthly' },
    razorpayPlanIds: { pro: null, ai: null },
    theme: { primary: '#7C5CFF', accent: '#22D3EE' },
  },
}

export function getApp(appId: string): AppRegistryEntry | undefined {
  return APPS[appId]
}

export function listApps(): AppRegistryEntry[] {
  return Object.values(APPS)
}
