export type AppFeature = {
  title: string
  body: string
}

export type AppInfo = {
  id: string
  name: string
  tagline: string
  description: string
  /** Short bullet list used on compact cards. */
  features: string[]
  /** Longer feature sections used on the app page. */
  featureDetails: AppFeature[]
  /** Topic/subject chips shown in marquees. */
  topics: string[]
  /** Store-listing images under /public/apps/<id>/. */
  screenshots: string[]
  playStoreUrl: string
  status: 'live' | 'coming-soon'
}

export const APPS: AppInfo[] = [
  {
    id: 'crackloop',
    name: 'CrackLoop',
    tagline: 'Learn. Practice. Crack.',
    description:
      'CrackLoop turns tech-interview prep into short, repeatable daily loops — swipeable concept cards, quizzes, an AI tutor, and mock interviews for DSA, system design, and CS fundamentals.',
    features: [
      'Swipeable concept cards with read-aloud',
      'Topic quizzes and timed mock exams',
      'AI tutor, voice chat, and mock interviews',
      'Streaks, badges, and spaced-repetition review',
      'Coding practice with an in-app playground',
      'Global and weekly leaderboards',
    ],
    featureDetails: [
      {
        title: 'Card-based learning',
        body: 'One concept per screen. Swipe through structured decks for DSA, system design, and CS foundations — resume where you left off, or let text-to-speech read topics aloud on a commute.',
      },
      {
        title: 'Quizzes & mock exams',
        body: 'Per-chapter MCQs with instant explanations, plus a timed exam mode that simulates real pressure. Wrong answers feed your review deck automatically.',
      },
      {
        title: 'AI tutor & mock interviews',
        body: 'Ask anything mid-topic, practice voice-based mock interviews, and get instant feedback — powered by an AI tutor that knows the material you are studying.',
      },
      {
        title: 'Streaks & spaced repetition',
        body: 'A daily plan, streak tracking, badges, and a spaced-repetition review deck keep concepts fresh long after you first learn them.',
      },
      {
        title: 'Coding practice',
        body: 'A LeetCode-style question catalog with an in-app code playground — practice implementation without leaving the app.',
      },
      {
        title: 'Compete on leaderboards',
        body: 'Global and weekly leaderboards with coin rewards turn showing up every day into a game you want to win.',
      },
    ],
    topics: [
      'Data structures',
      'Algorithms',
      'System design',
      'Operating systems',
      'Databases',
      'Networking',
      'OOP & design patterns',
      'Behavioral prep',
    ],
    screenshots: [
      '/apps/crackloop/main_screen.png',
      '/apps/crackloop/quiz.png',
      '/apps/crackloop/path.png',
      '/apps/crackloop/progress.png',
      '/apps/crackloop/page.png',
      '/apps/crackloop/page_play.png',
    ],
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.impactloop.crackloop',
    status: 'live',
  },
]

export function getApp(id: string): AppInfo | undefined {
  return APPS.find((a) => a.id === id)
}

/** The original / primary app. Legacy single-app flows default to this. */
export const DEFAULT_APP_ID = 'crackloop'
