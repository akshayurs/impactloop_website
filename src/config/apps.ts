export type AppInfo = {
  id: string
  name: string
  tagline: string
  description: string
  features: string[]
  playStoreUrl: string
  status: 'live' | 'coming-soon'
}

export const APPS: AppInfo[] = [
  {
    id: 'crackloop',
    name: 'CrackLoop',
    tagline: 'Crack your exams with focused daily loops.',
    description:
      'CrackLoop turns exam preparation into short, repeatable daily loops — practice, review, and track streaks so studying becomes a habit instead of a chore.',
    features: [
      'Daily practice loops with streak tracking',
      'Smart review of weak topics',
      'Progress analytics across subjects',
      'Distraction-free study sessions',
    ],
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.impactloop.crackloop',
    status: 'live',
  },
]

export function getApp(id: string): AppInfo | undefined {
  return APPS.find((a) => a.id === id)
}
