'use client'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Stat } from '@/components/ui/section'
import { Table } from '@/components/ui/table'
import { formatINR } from '@/lib/format'
import { useAuth } from '@/lib/auth-context'
import { adminFetch } from './admin/admin-fetch'

type InfluencerMe = {
  influencer: {
    status: 'pending' | 'approved' | 'rejected'
    promoCode: string | null
    discountPct: number
    commissionRates: { signupPaise: number; perPlan: Record<string, number> }
    socialLinks: string[]
    appliedAt: number
    decidedAt: number | null
  } | null
  suggestions: string[]
  earnings: {
    totalCommissionPaise: number
    paidPaise: number
    balancePaise: number
    referrals: Array<{
      id: string
      code: string
      referredUid: string
      type: 'signup' | 'subscription' | 'lifetime'
      planId: string | null
      commissionPaise: number
      createdAt: number
    }>
    payouts: Array<{
      id: string
      amountPaise: number
      note: string
      paidAt: number
    }>
    referralsCursor: string | null
    payoutsCursor: string | null
  } | null
}

type Referral = NonNullable<InfluencerMe['earnings']>['referrals'][number]
type Payout = NonNullable<InfluencerMe['earnings']>['payouts'][number]

export function InfluencerPortal() {
  const { user, loading, signIn } = useAuth()
  const [data, setData] = useState<InfluencerMe | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [customCode, setCustomCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [codeLoading, setCodeLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [referralsCursor, setReferralsCursor] = useState<string | null>(null)
  const [referralsPending, setReferralsPending] = useState(false)
  const [referralsError, setReferralsError] = useState(false)
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [payoutsCursor, setPayoutsCursor] = useState<string | null>(null)
  const [payoutsPending, setPayoutsPending] = useState(false)
  const [payoutsError, setPayoutsError] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoadError(false)
    try {
      const res = await adminFetch(user, '/api/influencer/me')
      if (!res.ok) throw new Error('failed')
      const json: InfluencerMe = await res.json()
      setData(json)
      setReferrals(json.earnings?.referrals ?? [])
      setReferralsCursor(json.earnings?.referralsCursor ?? null)
      setPayouts(json.earnings?.payouts ?? [])
      setPayoutsCursor(json.earnings?.payoutsCursor ?? null)
    } catch {
      setLoadError(true)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  async function loadMoreReferrals() {
    if (!user || !referralsCursor) return
    setReferralsPending(true)
    setReferralsError(false)
    try {
      const res = await adminFetch(user, `/api/influencer/referrals?cursor=${encodeURIComponent(referralsCursor)}`)
      if (!res.ok) throw new Error('failed')
      const json: { referrals: Referral[]; nextCursor: string | null } = await res.json()
      setReferrals((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        return [...prev, ...json.referrals.filter((r) => !seen.has(r.id))]
      })
      setReferralsCursor(json.nextCursor)
    } catch {
      setReferralsError(true)
    } finally {
      setReferralsPending(false)
    }
  }

  async function loadMorePayouts() {
    if (!user || !payoutsCursor) return
    setPayoutsPending(true)
    setPayoutsError(false)
    try {
      const res = await adminFetch(user, `/api/influencer/payouts?cursor=${encodeURIComponent(payoutsCursor)}`)
      if (!res.ok) throw new Error('failed')
      const json: { payouts: Payout[]; nextCursor: string | null } = await res.json()
      setPayouts((prev) => {
        const seen = new Set(prev.map((p) => p.id))
        return [...prev, ...json.payouts.filter((p) => !seen.has(p.id))]
      })
      setPayoutsCursor(json.nextCursor)
    } catch {
      setPayoutsError(true)
    } finally {
      setPayoutsPending(false)
    }
  }

  async function pickCode(code: string) {
    if (!user) return
    setCodeError(null)
    setActionMsg(null)
    setCodeLoading(true)
    try {
      const res = await adminFetch(user, '/api/influencer/promo-code', {
        method: 'POST',
        body: JSON.stringify({ code }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        setActionMsg('Code set!')
        setCustomCode('')
        await load()
      } else {
        setCodeError(json.error ?? 'Failed to set code')
      }
    } catch {
      setCodeError('Failed to set code')
    } finally {
      setCodeLoading(false)
    }
  }

  async function copyShareLink() {
    if (!data?.influencer?.promoCode) return
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/?ref=${data.influencer.promoCode}`
    try {
      await navigator.clipboard.writeText(url)
      setActionMsg('Link copied!')
    } catch {
      setActionMsg('Could not copy link')
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16" aria-busy="true" aria-label="Loading influencer portal">
        <div className="skeleton h-6 w-32 rounded-lg" />
        <div className="skeleton mt-6 h-32 rounded-2xl" />
      </div>
    )
  }

  if (!user) {
    return (
      <Card className="mx-auto mt-16 max-w-sm text-center">
        <p className="kicker justify-center">Partner portal</p>
        <p className="mt-4 text-sm text-muted">Sign in to view your promo code and earnings.</p>
        <div className="mt-6">
          <Button onClick={() => void signIn()}>Sign in</Button>
        </div>
      </Card>
    )
  }

  if (loadError) {
    return (
      <Card className="mx-auto mt-16 max-w-sm text-center">
        <p className="kicker justify-center">Partner portal</p>
        <p role="alert" className="mt-4 text-sm text-red-500">Couldn't load your profile.</p>
        <div className="mt-6">
          <Button variant="outline" size="sm" onClick={() => void load()}>Retry</Button>
        </div>
      </Card>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16" aria-busy="true" aria-label="Loading influencer portal">
        <div className="skeleton h-6 w-32 rounded-lg" />
        <div className="skeleton mt-6 h-32 rounded-2xl" />
      </div>
    )
  }

  const { influencer, suggestions, earnings } = data

  if (!influencer) {
    return (
      <Card className="mx-auto mt-16 max-w-sm text-center">
        <p className="kicker justify-center">Become a partner</p>
        <p className="mt-4 font-display text-2xl font-bold text-fg">Earn on every referral</p>
        <p className="mt-2 text-sm text-muted">Apply from your account page to start earning commission on referrals.</p>
        <div className="mt-6">
          <Button href="/account" variant="outline" size="sm">Go to account</Button>
        </div>
      </Card>
    )
  }

  if (influencer.status === 'pending') {
    return (
      <Card className="mx-auto mt-16 max-w-sm text-center">
        <p className="kicker justify-center">Partner portal</p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <Badge>pending</Badge>
          <p className="text-sm text-muted">Application under review</p>
        </div>
        <p className="mt-4 text-sm text-muted">
          We've received your application and will review it shortly. You'll be able to create a promo code once approved.
        </p>
      </Card>
    )
  }

  if (influencer.status === 'rejected') {
    return (
      <Card className="mx-auto mt-16 max-w-sm text-center">
        <p className="kicker justify-center">Partner portal</p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <Badge tone="danger">rejected</Badge>
        </div>
        <p className="mt-4 text-sm text-muted">Your application was not approved. You can apply again from your account page.</p>
        <div className="mt-6">
          <Button href="/account" variant="outline" size="sm">Reapply</Button>
        </div>
      </Card>
    )
  }

  const shareLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/?ref=${influencer.promoCode ?? ''}`

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="kicker">Promo code</p>
            <p className="mt-2 text-sm text-muted">Share your unique code to earn commissions</p>
          </div>
          <Badge tone="success">approved</Badge>
        </div>

        {influencer.promoCode ? (
          <div className="mt-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-lg border-2 border-line-strong bg-bg-raised px-3 py-2 font-mono text-sm font-medium tracking-wider text-accent">{influencer.promoCode}</code>
              <code className="grow truncate rounded-lg border border-line bg-card px-3 py-2 font-mono text-xs text-muted">{shareLink}</code>
              <Button variant="outline" size="sm" onClick={() => void copyShareLink()}>Copy link</Button>
            </div>
            {actionMsg ? <p role="status" className="text-xs text-muted">{actionMsg}</p> : null}
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCustomCode(influencer.promoCode || '')}
                className="text-xs"
              >
                Change code
              </Button>
            </div>
          </div>
        ) : null}

        {!influencer.promoCode || customCode ? (
          <div className="mt-5 space-y-3 border-t border-line pt-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
              {!influencer.promoCode ? 'Pick or create your promo code' : 'Create a new code'}
            </p>
            {suggestions.length > 0 && !customCode ? (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <Button key={s} variant="outline" size="sm" onClick={() => void pickCode(s)} disabled={codeLoading}>
                    {s}
                  </Button>
                ))}
              </div>
            ) : null}
            {customCode || suggestions.length === 0 ? (
              <div className="flex gap-2">
                <div className="grow">
                  <Input
                    label="Custom code"
                    placeholder="e.g., AKSHAY10"
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                    error={codeError ?? undefined}
                  />
                </div>
                <div className="flex items-end">
                  <Button size="sm" onClick={() => void pickCode(customCode)} disabled={codeLoading || !customCode}>
                    {codeLoading ? 'Setting…' : 'Set'}
                  </Button>
                </div>
              </div>
            ) : null}
            {codeError ? <p role="alert" className="text-xs text-red-500">{codeError}</p> : null}
          </div>
        ) : null}
      </Card>

      {earnings ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="Balance" value={formatINR(earnings.balancePaise)} highlight />
            <Stat label="Total earned" value={formatINR(earnings.totalCommissionPaise)} />
            <Stat label="Paid out" value={formatINR(earnings.paidPaise)} />
          </div>

          {referrals.length === 0 ? (
            <Card className="text-center">
              <p className="text-sm text-muted">
                No referrals yet — share your link or code and they will show up here.
              </p>
            </Card>
          ) : null}

          {referrals.length > 0 ? (
            <Card>
              <p className="kicker">Referrals</p>
              <div className="mt-4">
                <Table head={['Date', 'Type', 'Plan', 'Commission']}>
                  {referrals.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-mono text-sm">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm capitalize">{r.type}</td>
                      <td className="px-4 py-3 text-sm">
                        {r.planId ? (
                          <span>
                            <span className="text-accent">↳</span> {r.planId}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-fg">{formatINR(r.commissionPaise)}</td>
                    </tr>
                  ))}
                </Table>
              </div>
              {referralsError ? (
                <p role="alert" className="mt-4 text-center text-sm text-red-500">
                  Couldn’t load more referrals — try again.
                </p>
              ) : null}
              {referralsCursor ? (
                <div className="mt-4 flex justify-center">
                  <Button variant="outline" size="sm" disabled={referralsPending} onClick={() => void loadMoreReferrals()}>
                    {referralsPending ? 'Loading…' : 'Load more'}
                  </Button>
                </div>
              ) : null}
            </Card>
          ) : null}

          {payouts.length > 0 ? (
            <Card>
              <p className="kicker">Payouts</p>
              <ul className="mt-4 divide-y divide-line rounded-2xl border border-line text-sm">
                {payouts.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-mono text-fg">{new Date(p.paidAt).toLocaleDateString()}</p>
                      <p className="mt-0.5 text-xs text-muted">{p.note}</p>
                    </div>
                    <p className="font-medium text-fg">{formatINR(p.amountPaise)}</p>
                  </li>
                ))}
              </ul>
              {payoutsError ? (
                <p role="alert" className="mt-4 text-center text-sm text-red-500">
                  Couldn’t load more payouts — try again.
                </p>
              ) : null}
              {payoutsCursor ? (
                <div className="mt-4 flex justify-center">
                  <Button variant="outline" size="sm" disabled={payoutsPending} onClick={() => void loadMorePayouts()}>
                    {payoutsPending ? 'Loading…' : 'Load more'}
                  </Button>
                </div>
              ) : null}
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
