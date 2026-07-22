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

type AppEnrollment = {
  appId: string
  name: string
  status: 'pending' | 'approved' | 'rejected'
  promoCode: string | null
  discountPct: number
  commissionPaise: number
  suggestions: string[]
}

type Earnings = {
  totalCommissionPaise: number
  paidPaise: number
  balancePaise: number
  referrals: Array<{ id: string; appId?: string; type: string; planId: string | null; commissionPaise: number; createdAt: number }>
  payouts: Array<{ id: string; amountPaise: number; note: string; paidAt: number }>
  referralsCursor: string | null
  payoutsCursor: string | null
  payoutRequest: { amountPaise: number; requestedAt: number; upiId: string } | null
}

type Me = {
  profile: { socialLinks: string[]; appliedAt: number } | null
  apps: AppEnrollment[]
  availableApps: Array<{ appId: string; name: string }>
  earnings: Earnings | null
  minPayoutPaise: number
}

type Referral = Earnings['referrals'][number]
type Payout = Earnings['payouts'][number]

function origin(): string {
  return typeof window !== 'undefined' ? window.location.origin : ''
}

export function InfluencerPortal() {
  const { user, loading, signIn } = useAuth()
  const [data, setData] = useState<Me | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [editApp, setEditApp] = useState<string | null>(null)
  const [customCode, setCustomCode] = useState('')
  const [upiId, setUpiId] = useState('')
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [referralsCursor, setReferralsCursor] = useState<string | null>(null)
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [payoutsCursor, setPayoutsCursor] = useState<string | null>(null)
  const [pageBusy, setPageBusy] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoadError(false)
    try {
      const res = await adminFetch(user, '/api/influencer/me')
      if (!res.ok) throw new Error('failed')
      const json: Me = await res.json()
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

  async function enrollApp(appId: string) {
    if (!user) return
    setBusy(`enroll:${appId}`)
    setMsg(null)
    try {
      const res = await adminFetch(user, '/api/influencer/enroll', { method: 'POST', body: JSON.stringify({ appId }) })
      const json = await res.json().catch(() => ({}))
      setMsg(res.ok ? 'Enrolled — pending review.' : (json.error ?? 'Could not enroll.'))
      if (res.ok) await load()
    } finally {
      setBusy(null)
    }
  }

  async function pickCode(appId: string, code: string) {
    if (!user) return
    setBusy(`code:${appId}`)
    setMsg(null)
    try {
      const res = await adminFetch(user, '/api/influencer/promo-code', { method: 'POST', body: JSON.stringify({ appId, code }) })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        setMsg('Code set!')
        setEditApp(null)
        setCustomCode('')
        await load()
      } else {
        setMsg(json.error ?? 'Failed to set code')
      }
    } finally {
      setBusy(null)
    }
  }

  async function requestPayout() {
    if (!user) return
    setBusy('payout')
    setMsg(null)
    try {
      const res = await adminFetch(user, '/api/influencer/payout-request', { method: 'POST', body: JSON.stringify({ upiId: upiId.trim() }) })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        setMsg('Payout requested — we’ll process it soon.')
        setUpiId('')
        await load()
      } else {
        setMsg(json.error ?? 'Could not request payout.')
      }
    } finally {
      setBusy(null)
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setMsg('Link copied!')
    } catch {
      setMsg('Could not copy link')
    }
  }

  async function loadMore(kind: 'referrals' | 'payouts') {
    const cursor = kind === 'referrals' ? referralsCursor : payoutsCursor
    if (!user || !cursor) return
    setPageBusy(true)
    try {
      const res = await adminFetch(user, `/api/influencer/${kind}?cursor=${encodeURIComponent(cursor)}`)
      if (!res.ok) throw new Error('failed')
      const json = await res.json()
      if (kind === 'referrals') {
        setReferrals((prev) => [...prev, ...(json.referrals as Referral[]).filter((r) => !prev.some((p) => p.id === r.id))])
        setReferralsCursor(json.nextCursor)
      } else {
        setPayouts((prev) => [...prev, ...(json.payouts as Payout[]).filter((r) => !prev.some((p) => p.id === r.id))])
        setPayoutsCursor(json.nextCursor)
      }
    } finally {
      setPageBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16" aria-busy="true" aria-label="Loading partner portal">
        <div className="skeleton h-6 w-32 rounded-lg" />
        <div className="skeleton mt-6 h-32 rounded-2xl" />
      </div>
    )
  }

  if (!user) {
    return (
      <Card className="mx-auto mt-16 max-w-sm text-center">
        <p className="kicker justify-center">Partner portal</p>
        <p className="mt-4 text-sm text-muted">Sign in to view your apps and earnings.</p>
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
      <div className="mx-auto max-w-sm px-4 py-16" aria-busy="true" aria-label="Loading partner portal">
        <div className="skeleton h-6 w-32 rounded-lg" />
        <div className="skeleton mt-6 h-32 rounded-2xl" />
      </div>
    )
  }

  if (!data.profile) {
    return (
      <Card className="mx-auto mt-16 max-w-sm text-center">
        <p className="kicker justify-center">Become a partner</p>
        <p className="mt-4 font-display text-2xl font-bold text-fg">Earn on every referral</p>
        <p className="mt-2 text-sm text-muted">Join the program from your account, then enroll into the apps you want to promote.</p>
        <div className="mt-6">
          <Button href="/account" variant="outline" size="sm">Go to account</Button>
        </div>
      </Card>
    )
  }

  const { apps, availableApps, earnings } = data

  return (
    <div className="space-y-6">
      {msg ? <p role="status" className="text-xs text-muted">{msg}</p> : null}

      {earnings ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="Balance" value={formatINR(earnings.balancePaise)} highlight />
            <Stat label="Total earned" value={formatINR(earnings.totalCommissionPaise)} />
            <Stat label="Paid out" value={formatINR(earnings.paidPaise)} />
          </div>

          <Card>
            {earnings.payoutRequest ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="kicker">Payout</p>
                  <p className="mt-2 text-sm text-muted">
                    Requested {formatINR(earnings.payoutRequest.amountPaise)} on{' '}
                    {new Date(earnings.payoutRequest.requestedAt).toLocaleDateString()} — pending review.
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted">
                    Paying to <span className="text-fg">{earnings.payoutRequest.upiId}</span>
                  </p>
                </div>
                <Badge>requested</Badge>
              </div>
            ) : earnings.balancePaise < data.minPayoutPaise ? (
              <div>
                <p className="kicker">Payout</p>
                <p className="mt-2 text-sm text-muted">
                  Reach {formatINR(data.minPayoutPaise)} to request a payout — you’re at {formatINR(earnings.balancePaise)}.
                </p>
              </div>
            ) : (
              <div>
                <p className="kicker">Payout</p>
                <p className="mt-2 text-sm text-muted">Withdraw your {formatINR(earnings.balancePaise)} balance. This is your combined balance across all apps.</p>
                <div className="mt-4 flex flex-wrap items-end gap-2">
                  <div className="grow sm:max-w-xs">
                    <Input label="UPI ID" placeholder="name@bank" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
                  </div>
                  <Button size="sm" disabled={busy === 'payout' || !upiId.trim()} onClick={() => void requestPayout()}>
                    {busy === 'payout' ? 'Requesting…' : 'Request payout'}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      ) : null}

      <div>
        <p className="kicker">Your apps</p>
        <div className="mt-4 space-y-4">
          {apps.map((app) => {
            const shareLink = `${origin()}/apps/${app.appId}?ref=${app.promoCode ?? ''}`
            const editing = editApp === app.appId
            return (
              <Card key={app.appId}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-lg font-bold text-fg">{app.name}</h3>
                    {app.status === 'approved' ? (
                      <p className="mt-0.5 font-mono text-xs uppercase tracking-[0.14em] text-muted">
                        {app.discountPct}% off · earned {formatINR(app.commissionPaise)}
                      </p>
                    ) : null}
                  </div>
                  <Badge tone={app.status === 'approved' ? 'success' : app.status === 'pending' ? 'default' : 'danger'}>
                    {app.status}
                  </Badge>
                </div>

                {app.status === 'pending' ? (
                  <p className="mt-3 text-sm text-muted">Application under review — you can set a promo code once approved.</p>
                ) : null}
                {app.status === 'rejected' ? (
                  <p className="mt-3 text-sm text-muted">Not approved for this app.</p>
                ) : null}

                {app.status === 'approved' ? (
                  <div className="mt-4 space-y-3">
                    {app.promoCode ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="rounded-lg border-2 border-line-strong bg-bg-raised px-3 py-2 font-mono text-sm font-medium tracking-wider text-accent">{app.promoCode}</code>
                        <code className="grow truncate rounded-lg border border-line bg-card px-3 py-2 font-mono text-xs text-muted">{shareLink}</code>
                        <Button variant="outline" size="sm" onClick={() => void copyLink(shareLink)}>Copy link</Button>
                      </div>
                    ) : null}

                    {!app.promoCode || editing ? (
                      <div className="space-y-3 border-t border-line pt-3">
                        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
                          {app.promoCode ? 'Create a new code' : 'Pick or create your promo code'}
                        </p>
                        {app.suggestions.length > 0 && !editing ? (
                          <div className="flex flex-wrap gap-2">
                            {app.suggestions.map((s) => (
                              <Button key={s} variant="outline" size="sm" disabled={busy === `code:${app.appId}`} onClick={() => void pickCode(app.appId, s)}>
                                {s}
                              </Button>
                            ))}
                          </div>
                        ) : null}
                        <div className="flex items-end gap-2">
                          <div className="grow">
                            <Input label="Custom code" placeholder="e.g. AKSHAY10" value={customCode} onChange={(e) => setCustomCode(e.target.value.toUpperCase())} />
                          </div>
                          <Button size="sm" disabled={busy === `code:${app.appId}` || !customCode} onClick={() => void pickCode(app.appId, customCode)}>
                            {busy === `code:${app.appId}` ? 'Setting…' : 'Set'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setEditApp(app.appId); setCustomCode('') }}>
                        Change code
                      </Button>
                    )}
                  </div>
                ) : null}
              </Card>
            )
          })}

          {availableApps.length > 0 ? (
            <Card>
              <p className="kicker">Enroll in more apps</p>
              <div className="mt-3 space-y-2">
                {availableApps.map((a) => (
                  <div key={a.appId} className="flex items-center justify-between gap-3">
                    <span className="font-medium text-fg">{a.name}</span>
                    <Button size="sm" variant="outline" disabled={busy === `enroll:${a.appId}`} onClick={() => void enrollApp(a.appId)}>
                      {busy === `enroll:${a.appId}` ? 'Enrolling…' : 'Enroll'}
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      {referrals.length > 0 ? (
        <Card>
          <p className="kicker">Referrals</p>
          <div className="mt-4">
            <Table head={['Date', 'App', 'Type', 'Commission']}>
              {referrals.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-mono text-sm">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm">{r.appId ?? '—'}</td>
                  <td className="px-4 py-3 text-sm capitalize">{r.type}</td>
                  <td className="px-4 py-3 text-sm font-medium text-fg">{formatINR(r.commissionPaise)}</td>
                </tr>
              ))}
            </Table>
          </div>
          {referralsCursor ? (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" size="sm" disabled={pageBusy} onClick={() => void loadMore('referrals')}>
                {pageBusy ? 'Loading…' : 'Load more'}
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
          {payoutsCursor ? (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" size="sm" disabled={pageBusy} onClick={() => void loadMore('payouts')}>
                {pageBusy ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  )
}
