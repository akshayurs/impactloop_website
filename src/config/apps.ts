/**
 * Vendored app registry — synced manually from StudyAppTemplate/app/assets/flavors/*.json
 * Maps appId → metadata (name, content repo, Play product IDs, theme, Razorpay plans)
 */

export interface App {
  appId: string
  displayName: string
  contentRepo: string
  playProductIds: {
    pro: string
    ai: string
  }
  razorpayPlanIds: {
    pro: string | null
    ai: string | null
  }
  theme: {
    primary: string
    accent: string
  }
}

export const APPS: Record<string, App> = {
  crackloop: {
    appId: 'crackloop',
    displayName: 'CrackLoop',
    contentRepo: 'akshayurs/CrackLoopData',
    playProductIds: {
      pro: 'pro_monthly',
      ai: 'ai_monthly',
    },
    razorpayPlanIds: {
      pro: null,
      ai: null,
    },
    theme: {
      primary: '#7C5CFF',
      accent: '#22D3EE',
    },
  },
}

/**
 * Retrieve app metadata by appId; throws if not found.
 */
export function getApp(appId: string): App {
  const app = APPS[appId]
  if (!app) {
    throw new Error(`App not found: ${appId}`)
  }
  return app
}

/**
 * Retrieve app metadata by appId; returns null if not found.
 */
export function getAppOrNull(appId: string): App | null {
  return APPS[appId] ?? null
}

/**
 * List all registered app IDs.
 */
export function listAppIds(): string[] {
  return Object.keys(APPS)
}
