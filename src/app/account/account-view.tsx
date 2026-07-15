'use client'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmModal } from '@/components/ui/modal'
import { SectionHeader } from '@/components/ui/section'
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
  paymentsCursor: string | null
}

type Payment = Summary['payments'][number]

const TIER_LABEL = { pro: 'Pro', ai: 'AI' } as const

export function AccountView() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [fetchError, setFetchError] = useState(false)
  const [payments, setPayments] = useState<Payment[]>([])
  const [paymentsCursor, setPaymentsCursor] = useState<string | null>(null)
  const [paymentsPending, setPaymentsPending] = useState(false)
  const [paymentsError, setPaymentsError] = useState(false)
  const [cancelApp, setCancelApp] = useState<string | null>(null)
  const [cancelPending, setCancelPending] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [trialMsg, setTrialMsg] = useState<string | null>(null)
  const [trialPending, setTrialPending] = useState(false)
  const [influencerStatus, setInfluencerStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null)
  const [influencerLoading, setInfluencerLoading] = useState(false)
  const [socialLinks, setSocialLinks] = useState([''])
  const [applyPending, setApplyPending] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setFetchError(false)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/me/summary', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('summary failed')
      const data: Summary = await res.json()
      setSummary(data)
      setPayments(data.payments)
      setPaymentsCursor(data.paymentsCursor)
    } catch {
      setFetchError(true)
    }
  }, [user])

  async function loadMorePayments() {
    if (!user || !paymentsCursor) return
    setPaymentsPending(true)
    setPaymentsError(false)
    try {
      const token = await user.getIdToken()
      const res = await fetch(`/api/me/payments?cursor=${encodeURIComponent(paymentsCursor)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('payments failed')
      const data: { payments: Payment[]; nextCursor: string | null } = await res.json()
      setPayments((prev) => {
        const seen = new Set(prev.map((p) => p.id))
        return [...prev, ...data.payments.filter((p) => !seen.has(p.id))]
      })
      setPaymentsCursor(data.nextCursor)
    } catch {
      setPaymentsError(true)
    } finally {
      setPaymentsPending(false)
    }
  }

  useEffect(() => {
    if (!loading && !user) router.replace('/')
  }, [loading, user, router])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!user) return
    void (async () => {
      setInfluencerLoading(true)
      try {
        const token = await user.getIdToken()
        const res = await fetch('/api/influencer/me', { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) {
          const data = await res.json()
          if (data.influencer) setInfluencerStatus(data.influencer.status)
        }
      } catch {
        /* ignore */
      } finally {
        setInfluencerLoading(false)
      }
    })()
  }, [user])

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

  async function applyInfluencer() {
    if (!user) return
    setApplyPending(true)
    setApplyError(null)
    try {
      const token = await user.getIdToken()
      const validLinks = socialLinks.filter((l) => l.trim())
      const res = await fetch('/api/influencer/apply', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ socialLinks: validLinks }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setApplyError(data.error ?? 'Application failed.')
        return
      }
      setInfluencerStatus('pending')
      setSocialLinks([''])
    } catch {
      setApplyError('Application failed.')
    } finally {
      setApplyPending(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6" aria-busy="true" aria-label="Loading account">
        <div className="skeleton h-4 w-28 rounded-full" />
        <div className="skeleton mt-4 h-9 w-40 rounded-lg" />
        <div className="skeleton mt-10 h-28 rounded-2xl" />
        <div className="skeleton mt-10 h-5 w-32 rounded" />
        <div className="skeleton mt-4 h-32 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="kicker">Your account</p>
      <h1 className="mt-4 font-display text-4xl font-bold text-fg">Account</h1>

      <Card className="mt-10">
        <div className="flex items-center gap-4">
          {user.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photoURL} alt="" className="h-12 w-12 rounded-full border border-line" referrerPolicy="no-referrer" />
          ) : (
            <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft font-display text-lg font-semibold text-accent">
              {(user.displayName ?? user.email ?? '?').charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-fg">{user.displayName ?? user.email}</p>
            <p className="truncate text-sm text-muted">{user.email}</p>
          </div>
          <Button variant="outline" size="sm" className="ml-auto shrink-0" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </Card>

      <div className="mt-12">
        <SectionHeader kicker="Subscriptions" />
      </div>
      {cancelError ? (
        <p role="alert" className="mt-4 text-sm text-red-500">
          {cancelError}
        </p>
      ) : null}
      {fetchError ? (
        <Card className="mt-6">
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
        <div className="skeleton mt-6 h-28 rounded-2xl" aria-label="Loading subscriptions" />
      ) : summary.apps.length === 0 ? (
        <Card className="mt-6">
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
          <Card key={appId} className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-xl font-bold capitalize text-fg">{appId}</h3>
              {subscription ? (
                <Badge tone={subscription.status === 'trial' ? 'default' : subscription.status === 'active' || subscription.status === 'lifetime' ? 'success' : 'warn'}>
                  {subscription.status}
                </Badge>
              ) : null}
            </div>
            {subscription ? (
              <>
                <p className="mt-3 font-mono text-xs uppercase tracking-[0.18em] text-muted">
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
                <p className="mt-3 text-sm text-muted">No active subscription.</p>
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

      <div className="mt-12">
        <SectionHeader kicker="Influencer program" />
      </div>
      {influencerLoading ? (
        <div className="skeleton mt-6 h-24 rounded-2xl" aria-label="Loading influencer status" />
      ) : influencerStatus ? (
        <Card className="mt-6">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
              {influencerStatus === 'pending' && 'Application under review'}
              {influencerStatus === 'approved' && 'Approved'}
              {influencerStatus === 'rejected' && 'Application rejected'}
            </p>
            <Badge tone={influencerStatus === 'approved' ? 'success' : influencerStatus === 'pending' ? 'default' : 'warn'}>
              {influencerStatus}
            </Badge>
          </div>
          <div className="mt-4">
            <Button href="/influencer" variant="outline" size="sm">
              View portal
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="mt-6">
          <p className="mb-4 text-sm text-muted">Earn commissions by referring users with your promo code.</p>
          {applyError ? (
            <p role="alert" className="mb-4 text-sm text-red-500">
              {applyError}
            </p>
          ) : null}
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-muted">Social links</p>
          <div className="space-y-3">
            {socialLinks.map((link, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://instagram.com/your-handle"
                  value={link}
                  onChange={(e) => {
                    const newLinks = [...socialLinks]
                    newLinks[i] = e.target.value
                    setSocialLinks(newLinks)
                  }}
                  className="h-10 flex-1 rounded-lg border border-line bg-card px-3 text-sm text-fg placeholder:text-muted"
                />
                {socialLinks.length > 1 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSocialLinks(socialLinks.filter((_, j) => j !== i))}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
          {socialLinks.length < 5 ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setSocialLinks([...socialLinks, ''])}
            >
              + Add link
            </Button>
          ) : null}
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              onClick={() => void applyInfluencer()}
              disabled={applyPending || !socialLinks.some((l) => l.trim())}
            >
              {applyPending ? 'Applying…' : 'Apply'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSocialLinks([''])
                setApplyError(null)
              }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {payments.length > 0 ? (
        <>
          <div className="mt-12">
            <SectionHeader kicker="Payment history" />
          </div>
          <Card className="mt-6 p-0">
            <ul className="divide-y divide-line">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 px-6 py-4 text-sm">
                  <span className="min-w-0 truncate text-muted">
                    <span className="font-mono text-xs text-muted">{new Date(p.createdAt).toLocaleDateString()}</span>
                    {' · '}
                    <span className="capitalize">{p.appId}</span>
                    {' · '}
                    {p.type}
                  </span>
                  <span className="shrink-0 font-display font-semibold text-fg">{formatINR(p.amountPaise)}</span>
                </li>
              ))}
            </ul>
          </Card>
          {paymentsError ? (
            <p role="alert" className="mt-4 text-center text-sm text-red-500">
              Couldn’t load more payments — try again.
            </p>
          ) : null}
          {paymentsCursor ? (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" size="sm" disabled={paymentsPending} onClick={() => void loadMorePayments()}>
                {paymentsPending ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          ) : null}
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
