'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PromoInput } from '@/components/promo-input'
import type { Plan } from '@/config/plans'
import { useAuth } from '@/lib/auth-context'

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void }
  }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve()
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('failed to load checkout'))
    document.body.appendChild(script)
  })
}

export function CheckoutButton({ plan }: { plan: Plan }) {
  const { user, signIn } = useAuth()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [promoCode, setPromoCode] = useState<string | null>(null)

  async function startCheckout() {
    if (!user) {
      await signIn()
      return
    }
    setPending(true)
    setError(null)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, ...(promoCode ? { promoCode } : {}) }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409) throw new Error('You already have an active plan for this app.')
      if (!res.ok) throw new Error(data.error ?? 'Checkout failed. Try again.')

      await loadRazorpayScript()
      const base = {
        key: data.keyId,
        name: 'Impact Loop',
        theme: { color: '#e05d10' },
      }
      if (data.mode === 'subscription') {
        new window.Razorpay!({
          ...base,
          subscription_id: data.subscriptionId,
          handler: () => window.location.assign('/account'),
        }).open()
      } else {
        new window.Razorpay!({
          ...base,
          order_id: data.orderId,
          amount: data.amountPaise,
          currency: 'INR',
          handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            try {
              const verifyRes = await fetch('/api/checkout/verify', {
                method: 'POST',
                headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  orderId: resp.razorpay_order_id,
                  paymentId: resp.razorpay_payment_id,
                  signature: resp.razorpay_signature,
                }),
              })
              if (verifyRes.ok) window.location.assign('/account')
              else setError('Payment received but verification failed — contact support.')
            } catch {
              setError('Payment received but verification failed — contact support.')
            }
          },
        }).open()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed. Try again.')
    } finally {
      setPending(false)
    }
  }

  const label = !user ? 'Sign in to subscribe' : plan.lifetime ? 'Buy once' : 'Subscribe'
  return (
    <div className="flex flex-col gap-3">
      <Button onClick={() => void startCheckout()} disabled={pending} className="w-full">
        {pending ? 'Starting…' : label}
      </Button>
      <details className="group">
        <summary className="cursor-pointer list-none text-xs text-muted underline-offset-2 hover:text-fg hover:underline [&::-webkit-details-marker]:hidden">
          Have a promo code?
        </summary>
        <div className="mt-2">
          <PromoInput onApply={setPromoCode} durationMonths={plan.durationMonths} />
        </div>
      </details>
      {error ? (
        <p role="alert" className="text-xs text-red-500">
          {error}
        </p>
      ) : null}
    </div>
  )
}
