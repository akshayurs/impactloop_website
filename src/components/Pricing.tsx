'use client'

import { useState } from 'react'
import Script from 'next/script'
import { useAuth } from '@/lib/auth'
import { listApps, type AppRegistryEntry } from '@/config/apps'
import type { Tier } from '@/lib/subscription-request'

type TierCopy = { tier: Tier; label: string; price: string; blurb: string }

const TIERS: TierCopy[] = [
  { tier: 'pro', label: 'Pro', price: '₹99/mo', blurb: 'Ad-free, unlimited practice content.' },
  { tier: 'ai', label: 'AI', price: '₹199/mo', blurb: 'Everything in Pro, plus unlimited AI tutor & mock interviews.' },
]

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void }
  }
}

export default function Pricing() {
  const { user, signIn } = useAuth()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function subscribe(app: AppRegistryEntry, tier: Tier) {
    setError(null)
    const key = `${app.appId}:${tier}`
    setPending(key)
    try {
      if (!user) {
        await signIn()
        setPending(null)
        return
      }

      const token = await user.getIdToken()
      const res = await fetch('/api/razorpay/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ appId: app.appId, tier }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Request failed (${res.status})`)
      }

      const { subscriptionId, keyId } = (await res.json()) as { subscriptionId: string; keyId: string }

      if (typeof window === 'undefined' || !window.Razorpay) {
        throw new Error('Checkout is still loading — try again in a moment.')
      }

      const rzp = new window.Razorpay({
        key: keyId,
        subscription_id: subscriptionId,
        name: app.displayName,
        description: tier === 'ai' ? 'AI subscription' : 'Pro subscription',
        handler: () => {
          window.location.href = '/account'
        },
      })
      rzp.open()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setPending(null)
    }
  }

  return (
    <main className="min-h-screen bg-ink text-white px-6 py-16">
      {/* Razorpay Checkout cannot be self-hosted — this external script is a required
          exception to the no-external-CDN constraint (payments-only). */}
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />

      <div className="mx-auto max-w-content">
        <h1 className="font-display text-3xl mb-2">Pricing</h1>
        <p className="text-white/60 mb-10">Subscribe to Pro or AI for any Impact Loop app.</p>

        {error && (
          <div className="mb-8 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-8">
          {listApps().map((app) => (
            <section key={app.appId} className="rounded-2xl border border-white/10 p-6" style={{ background: `${app.theme.primary}14` }}>
              <h2 className="font-display text-xl mb-4">{app.displayName}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {TIERS.map((t) => {
                  const key = `${app.appId}:${t.tier}`
                  const disabled = !app.razorpayPlanIds[t.tier]
                  return (
                    <div key={t.tier} className="rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col gap-3">
                      <div>
                        <div className="font-display text-lg">{t.label}</div>
                        <div className="text-white/50 text-sm">{t.blurb}</div>
                      </div>
                      <div className="text-2xl font-semibold">{t.price}</div>
                      <button
                        onClick={() => subscribe(app, t.tier)}
                        disabled={disabled || pending === key}
                        className="mt-auto rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink transition-transform hover:scale-[1.03] disabled:opacity-40 disabled:hover:scale-100"
                      >
                        {disabled ? 'Coming soon' : pending === key ? 'Starting…' : 'Subscribe'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
