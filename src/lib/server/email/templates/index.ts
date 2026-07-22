import { crackloopTemplates } from './crackloop'
import type { AppEmailTemplates } from './types'

/* One template set per app; future apps register their own folder here. */
const APP_TEMPLATES: Record<string, AppEmailTemplates> = {
  crackloop: crackloopTemplates,
}

export function getAppTemplates(appId: string): AppEmailTemplates | null {
  return APP_TEMPLATES[appId] ?? null
}
