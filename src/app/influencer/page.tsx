import type { Metadata } from 'next'
import { InfluencerPortal } from '@/components/influencer-portal'

export const metadata: Metadata = {
  title: 'Partner portal',
  description: 'Track your promo code, referrals, and payouts.',
}

export default function InfluencerPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-4xl font-bold text-fg">Partner portal</h1>
      <p className="mt-2 text-muted">Your promo code, referrals, and payouts in one place.</p>
      <div className="mt-8">
        <InfluencerPortal />
      </div>
    </div>
  )
}
