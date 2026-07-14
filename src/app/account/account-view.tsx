'use client'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmModal } from '@/components/ui/modal'
import { formatINR } from '@/lib/format'
import { useAuth } from '@/lib/auth-context'

type Summary = {
  apps: Array<{
    appId: string
    subscription: {
      status: string
      planId: string
      tier: 'pro' | 'ai'
      expiryTimeMillis: number | null
      autoRenewing: boolean
      razorpaySubscriptionId: string | null
    } | null
    entitlements: { adFree: boolean; unlimitedAi: boolean } | null
  }>
  payments: Array<{ id: string; amountPaise: number; planId: string; appId: string; type: string; createdAt: number }>
}

const TIER_LABEL = { pro: 'Pro', ai: 'AI' } as const

export function AccountView() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [fetchError, setFetchError] = useState(false)
  const [cancelApp, setCancelApp] = useState<string | null>(null)
  const [cancelPending, setCancelPending] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [trialMsg, setTrialMsg] = useState<string | null>(null)
  const [trialPending, setTrialPending] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setFetchError(false)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/me/summary', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('summary failed')
      setSummary(await res.json())
    } catch {
      setFetchError(true)
    }
  }, [user])

  useEffect(() => {
    if (!loading && !user) router.replace('/')
  }, [loading, user, router])

  useEffect(() => {
    void load()
  }, [load])

  async function requestTrial(appId: string) {
    if (!user) return
    setTrialPending(true)
    setTrialMsg(null)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/trial', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setTrialMsg(data.error === 'not eligible for trial' ? 'Trial not available for this account.' : 'Trial not available right now.')
        return
      }
      setTrialMsg('Trial started!')
      await load()
    } finally {
      setTrialPending(false)
    }
  }

  async function confirmCancel() {
    if (!user || !cancelApp) return
    setCancelPending(true)
    setCancelError(null)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: cancelApp }),
      })
      if (!res.ok) {
        setCancelError("Couldn't cancel — try again.")
        return
      }
      await load()
      setCancelApp(null)
    } catch {
      setCancelError("Couldn't cancel — try again.")
    } finally {
      setCancelPending(false)
    }
  }

  if (loading || !user) {
    return <p className="px-4 py-16 text-center text-muted">Loading…</p>
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-fg">Account</h1>

      <Card className="mt-8">
        <p className="text-sm text-muted">Signed in as</p>
        <p className="mt-1 font-medium text-fg">{user.displayName ?? user.email}</p>
        <p className="text-sm text-muted">{user.email}</p>
        <div className="mt-6">
          <Button variant="outline" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </Card>

      <h2 className="mt-10 font-display text-xl font-semibold text-fg">Subscriptions</h2>
      {cancelError ? (
        <p role="alert" className="mt-2 text-sm text-red-500">
          {cancelError}
        </p>
      ) : null}
      {fetchError ? (
        <Card className="mt-4">
          <p role="alert" className="text-sm text-red-500">
            Couldn’t load your subscriptions.
          </p>
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        </Card>
      ) : !summary ? (
        <p className="mt-4 text-sm text-muted">Loading…</p>
      ) : summary.apps.length === 0 ? (
        <Card className="mt-4">
          <p className="text-sm text-muted">No subscriptions yet.</p>
          <div className="mt-4 flex gap-2">
            <Button href="/pricing" size="sm">
              See plans
            </Button>
            <Button variant="outline" size="sm" disabled={trialPending} onClick={() => void requestTrial('crackloop')}>
              {trialPending ? 'Starting trial…' : 'Try free trial'}
            </Button>
          </div>
          {trialMsg ? <p role="status" className="mt-2 text-xs text-muted">{trialMsg}</p> : null}
        </Card>
      ) : (
        summary.apps.map(({ appId, subscription }) => (
          <Card key={appId} className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-lg font-semibold capitalize text-fg">{appId}</h3>
              {subscription ? (
                <Badge tone={subscription.status === 'trial' ? 'default' : subscription.status === 'active' || subscription.status === 'lifetime' ? 'success' : 'warn'}>
                  {subscription.status}
                </Badge>
              ) : null}
            </div>
            {subscription ? (
              <>
                <p className="mt-2 text-sm text-muted">
                  {subscription.status === 'trial' ? (
                    `Trial ends ${new Date(subscription.expiryTimeMillis!).toLocaleDateString()}`
                  ) : (
                    <>
                      {TIER_LABEL[subscription.tier]} ·{' '}
                      {subscription.expiryTimeMillis === null
                        ? 'Lifetime'
                        : `${subscription.autoRenewing ? 'Renews' : 'Ends'} ${new Date(subscription.expiryTimeMillis).toLocaleDateString()}`}
                    </>
                  )}
                </p>
                {subscription.autoRenewing && subscription.razorpaySubscriptionId ? (
                  <div className="mt-4">
                    <Button variant="outline" size="sm" onClick={() => setCancelApp(appId)}>
                      Cancel subscription
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted">No active subscription.</p>
                <div className="mt-4">
                  <Button variant="outline" size="sm" disabled={trialPending} onClick={() => void requestTrial(appId)}>
                    {trialPending ? 'Starting trial…' : 'Try free trial'}
                  </Button>
                </div>
                {trialMsg ? <p role="status" className="mt-2 text-xs text-muted">{trialMsg}</p> : null}
              </>
            )}
          </Card>
        ))
      )}

      {summary && summary.payments.length > 0 ? (
        <>
          <h2 className="mt-10 font-display text-xl font-semibold text-fg">Payment history</h2>
          <Card className="mt-4">
            <ul className="divide-y divide-line">
              {summary.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-3 text-sm">
                  <span className="text-muted">
                    {new Date(p.createdAt).toLocaleDateString()} · {p.appId} · {p.type}
                  </span>
                  <span className="font-medium text-fg">{formatINR(p.amountPaise)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      ) : null}

      <ConfirmModal
        open={cancelApp !== null}
        title="Cancel subscription?"
        body="Your plan stays active until the end of the current billing period, then won’t renew."
        confirmLabel={cancelPending ? 'Cancelling…' : 'Yes, cancel'}
        onConfirm={() => void confirmCancel()}
        onClose={() => setCancelApp(null)}
        destructive
      />
    </div>
  )
}
