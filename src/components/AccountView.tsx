'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { doc, onSnapshot } from 'firebase/firestore'
import { useAuth } from '@/lib/auth'
import { db } from '@/lib/firebase'
import { listApps } from '@/config/apps'

type AppSubscription = {
  tier?: string
  status?: string
  expiryTimeMillis?: number
  razorpaySubscriptionId?: string
}

type AppEntitlements = {
  unlimitedAi?: boolean
  adFree?: boolean
}

type AppEntitlementDoc = {
  subscription?: AppSubscription
  entitlements?: AppEntitlements
}

const ACTIVE_STATUSES = new Set(['active', 'authenticated'])

function AppCard({ appId, displayName, primaryColor }: { appId: string; displayName: string; primaryColor: string }) {
  const { user } = useAuth()
  const [data, setData] = useState<AppEntitlementDoc | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const ref = doc(db, 'users', user.uid, 'apps', appId)
    const unsubscribe = onSnapshot(ref, (snap) => {
      setData(snap.exists() ? (snap.data() as AppEntitlementDoc) : null)
    })
    return () => unsubscribe()
  }, [user, appId])

  const subscription = data?.subscription
  const entitlements = data?.entitlements
  const isActive = !!subscription?.status && ACTIVE_STATUSES.has(subscription.status)

  async function cancel() {
    if (!user) return
    setError(null)
    setCancelling(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ appId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Request failed (${res.status})`)
      }
      setCancelled(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel. Please try again.')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 p-5" style={{ background: `${primaryColor}14` }}>
      <div className="font-display text-lg">{displayName}</div>

      {!subscription ? (
        <div className="text-white/50 text-sm mt-1">No active subscription</div>
      ) : (
        <div className="mt-1 space-y-1">
          <div className="text-white/80 text-sm capitalize">
            {subscription.tier ?? 'unknown'} tier · {subscription.status ?? 'unknown'}
          </div>
          {subscription.expiryTimeMillis && (
            <div className="text-white/50 text-xs">
              Renews {new Date(subscription.expiryTimeMillis).toLocaleDateString()}
            </div>
          )}
          {(entitlements?.unlimitedAi || entitlements?.adFree) && (
            <div className="flex gap-2 mt-2">
              {entitlements?.unlimitedAi && (
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs">Unlimited AI</span>
              )}
              {entitlements?.adFree && (
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs">Ad-free</span>
              )}
            </div>
          )}
          {isActive && !cancelled && (
            <button
              onClick={cancel}
              disabled={cancelling}
              className="mt-3 rounded-full border border-white/20 px-4 py-1.5 text-xs hover:bg-white/10 disabled:opacity-40"
            >
              {cancelling ? 'Cancelling…' : 'Cancel'}
            </button>
          )}
          {cancelled && <div className="text-white/50 text-xs mt-3">Cancels at period end</div>}
          {error && <div className="text-red-300 text-xs mt-2">{error}</div>}
        </div>
      )}
    </div>
  )
}

export default function AccountView() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/')
  }, [loading, user, router])

  if (loading || !user) return <main className="min-h-screen bg-ink text-white grid place-items-center">Loading…</main>

  return (
    <main className="min-h-screen bg-ink text-white px-6 py-16">
      <div className="mx-auto max-w-content">
        <h1 className="font-display text-3xl mb-2">Your account</h1>
        <p className="text-white/60 mb-10">{user.displayName} · {user.email}</p>
        <h2 className="font-display text-xl mb-4">Apps</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listApps().map((app) => (
            <AppCard key={app.appId} appId={app.appId} displayName={app.displayName} primaryColor={app.theme.primary} />
          ))}
        </div>
      </div>
    </main>
  )
}
