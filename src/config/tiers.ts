/* Marketing content for a pricing tier card. Lives in Firestore (`tiers/{appId}_{tier}`),
   admin-editable at /admin/plans; STATIC_TIERS is the no-DB fallback. */
export type TierContent = {
  id: string
  appId: string
  tier: 'pro' | 'ai'
  title: string
  blurb: string
  benefits: string[]
  /** Badge above the card, e.g. "Most popular" / "Launch offer". Empty = no badge. */
  offerName: string
  /** Label appended to the computed savings %, e.g. "vs Google Play". */
  compareLabel: string
  /** Highlighted card styling (accent border + glow). */
  highlight: boolean
  sort: number
}

export const STATIC_TIERS: TierContent[] = [
  {
    id: 'crackloop_pro',
    appId: 'crackloop',
    tier: 'pro',
    title: 'Pro',
    blurb: 'The full learning experience, ad-free.',
    benefits: [
      'All concept decks unlocked',
      'Quizzes, mock exams & review deck',
      'Streaks, badges & leaderboards',
      'Completely ad-free',
    ],
    offerName: 'Most popular',
    compareLabel: 'vs Google Play',
    highlight: true,
    sort: 1,
  },
  {
    id: 'crackloop_ai',
    appId: 'crackloop',
    tier: 'ai',
    title: 'AI',
    blurb: 'Unlimited AI tutoring on top of everything.',
    benefits: [
      'Unlimited AI tutor chat',
      'Voice chat & mock interviews',
      'Instant explanations mid-topic',
      'Metered fairly, cancel anytime',
    ],
    offerName: '',
    compareLabel: 'vs Google Play',
    highlight: false,
    sort: 2,
  },
]
