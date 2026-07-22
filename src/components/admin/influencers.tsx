'use client'
import { useCallback, useEffect, useState } from 'react'
import { APPS, DEFAULT_APP_ID } from '@/config/apps'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmModal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { formatINR } from '@/lib/format'
import { useAuth } from '@/lib/auth-context'
import { adminFetch } from './admin-fetch'

type PartnerConfig = { discountPct: number; enabled: boolean }

type InfluencerRow = {
  uid: string
  email: string | null
  status: 'pending' | 'approved' | 'rejected'
  appliedAt: number
  promoCode: string | null
  discountPct: number
  commissionRates: { signupPaise: number; perPlan: Record<string, number> }
}

type Plan = { id: string; appId: string; active: boolean }

export function AdminInfluencers() {
  const { user } = useAuth()
  const [appId, setAppId] = useState(DEFAULT_APP_ID)
  const [config, setConfig] = useState<PartnerConfig | null>(null)
  const [configForm, setConfigForm] = useState<{ discountPct: string; enabled: boolean } | null>(null)
  const [configPending, setConfigPending] = useState(false)
  const [influencers, setInfluencers] = useState<InfluencerRow[] | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [sortBy, setSortBy] = useState<'applied-desc' | 'applied-asc' | 'email-asc'>('applied-desc')
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [error, setError] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState(false)
  const [openUid, setOpenUid] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [earnings, setEarnings] = useState<any | null>(null)
  const [payoutForm, setPayoutForm] = useState({ amount: '', note: '' })
  const [payoutPending, setPayoutPending] = useState(false)
  const [reqUpi, setReqUpi] = useState('')
  const [reqPending, setReqPending] = useState(false)
  const [confirmReject, setConfirmReject] = useState<string | null>(null)
  const [confirmPay, setConfirmPay] = useState<{ body: string; run: () => void } | null>(null)
  const [ratesForm, setRatesForm] = useState<{
    signupPaise: string
    perPlan: Record<string, string>
  } | null>(null)
  const [ratesPending, setRatesPending] = useState(false)
  const [codeForm, setCodeForm] = useState('')
  const [codePending, setCodePending] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setError(false)
    setLoadMoreError(false)
    try {
      const params = new URLSearchParams({ appId })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await adminFetch(user, `/api/admin/influencers?${params}`)
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setInfluencers(data.influencers)
      setNextCursor(data.nextCursor ?? null)
      const [plansRes, configRes] = await Promise.all([
        adminFetch(user, '/api/admin/plans'),
        adminFetch(user, `/api/admin/partner-config?appId=${appId}`),
      ])
      if (plansRes.ok) {
        const allPlans = (await plansRes.json()).plans
        setPlans(allPlans.filter((p: any) => p.active && p.appId === appId))
      }
      if (configRes.ok) {
        const c: PartnerConfig = (await configRes.json()).config
        setConfig(c)
        setConfigForm({ discountPct: String(c.discountPct), enabled: c.enabled })
      }
    } catch {
      setError(true)
    }
  }, [user, statusFilter, appId])

  async function saveConfig() {
    if (!user || !configForm) return
    setConfigPending(true)
    setActionMsg(null)
    try {
      const res = await adminFetch(user, '/api/admin/partner-config', {
        method: 'PUT',
        body: JSON.stringify({ appId, discountPct: parseInt(configForm.discountPct, 10), enabled: configForm.enabled }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setConfig(data.config)
        setActionMsg('App partner settings saved.')
      } else {
        setActionMsg(data.error ?? 'Save failed.')
      }
    } finally {
      setConfigPending(false)
    }
  }

  useEffect(() => {
    void load()
  }, [load])

  async function loadMore() {
    if (!user || !nextCursor) return
    setLoadingMore(true)
    setLoadMoreError(false)
    try {
      const params = new URLSearchParams({ appId, cursor: nextCursor })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await adminFetch(user, `/api/admin/influencers?${params}`)
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setInfluencers((prev) => {
        const existing = new Set((prev ?? []).map((i) => i.uid))
        const additions = (data.influencers as InfluencerRow[]).filter((i) => !existing.has(i.uid))
        return [...(prev ?? []), ...additions]
      })
      setNextCursor(data.nextCursor ?? null)
    } catch {
      setLoadMoreError(true)
    } finally {
      setLoadingMore(false)
    }
  }

  async function openDetail(uid: string) {
    setOpenUid(uid)
    setActionMsg(null)
    setEarnings(null)
    setPayoutForm({ amount: '', note: '' })
    setReqUpi('')
    setRatesForm(null)
    setCodeForm('')
    const res = await adminFetch(user!, '/api/admin/influencers/' + uid, {
      method: 'POST',
      body: JSON.stringify({ action: 'earnings', appId }),
    })
    if (res.ok) {
      setEarnings(await res.json())
    } else {
      setActionMsg('Failed to load earnings.')
    }
  }

  async function decide(uid: string, decision: 'approved' | 'rejected') {
    if (!user) return
    setActionMsg(null)
    const res = await adminFetch(user, `/api/admin/influencers/${uid}`, {
      method: 'POST',
      body: JSON.stringify({ action: decision, appId }),
    })
    const data = await res.json().catch(() => ({}))
    setActionMsg(res.ok ? 'Done.' : (data.error ?? 'Action failed.'))
    if (res.ok) {
      setConfirmReject(null)
      await load()
      if (openUid === uid) await openDetail(uid)
    }
  }

  async function startEditRates(inf: InfluencerRow) {
    const perPlan: Record<string, string> = {}
    if (plans) {
      for (const p of plans) {
        perPlan[p.id] = String(inf.commissionRates.perPlan[p.id] ?? 0)
      }
    }
    setRatesForm({
      signupPaise: String(inf.commissionRates.signupPaise),
      perPlan,
    })
  }

  async function submitRates(uid: string) {
    if (!user || !ratesForm) return
    setRatesPending(true)
    setActionMsg(null)
    const perPlan: Record<string, number> = {}
    if (plans) {
      for (const p of plans) {
        const val = parseInt(ratesForm.perPlan[p.id] || '0', 10)
        if (!isNaN(val) && val >= 0) perPlan[p.id] = val
      }
    }
    const res = await adminFetch(user, `/api/admin/influencers/${uid}`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'update-rates',
        appId,
        signupPaise: parseInt(ratesForm.signupPaise, 10),
        perPlan,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setActionMsg(res.ok ? 'Rates updated.' : (data.error ?? 'Update failed.'))
    if (res.ok) {
      setRatesForm(null)
      await load()
      if (openUid === uid) await openDetail(uid)
    }
    setRatesPending(false)
  }

  async function submitCode(uid: string) {
    if (!user || !codeForm.trim()) return
    setCodePending(true)
    setActionMsg(null)
    const res = await adminFetch(user, `/api/admin/influencers/${uid}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'set-code', appId, code: codeForm.trim().toUpperCase() }),
    })
    const data = await res.json().catch(() => ({}))
    setActionMsg(res.ok ? `Code set to ${data.code}.` : (data.error ?? 'Code change failed.'))
    if (res.ok) {
      setCodeForm('')
      await load()
    }
    setCodePending(false)
  }

  async function submitPayout(uid: string) {
    if (!user) return
    setPayoutPending(true)
    setActionMsg(null)
    const amountPaise = Math.round(Number(payoutForm.amount) * 100)
    const res = await adminFetch(user, `/api/admin/influencers/${uid}`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'mark-paid',
        appId,
        amountPaise,
        note: payoutForm.note,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setActionMsg(res.ok ? 'Payout recorded.' : (data.error ?? 'Payout failed.'))
    if (res.ok) {
      setPayoutForm({ amount: '', note: '' })
      if (openUid === uid) await openDetail(uid)
    }
    setPayoutPending(false)
  }

  async function createRequest(uid: string) {
    if (!user || !reqUpi.trim()) return
    setReqPending(true)
    setActionMsg(null)
    const res = await adminFetch(user, `/api/admin/influencers/${uid}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'request-payout', appId, upiId: reqUpi.trim() }),
    })
    const data = await res.json().catch(() => ({}))
    setActionMsg(res.ok ? 'Payout request created.' : (data.error ?? 'Request failed.'))
    if (res.ok) {
      setReqUpi('')
      if (openUid === uid) await openDetail(uid)
    }
    setReqPending(false)
  }

  async function markRequestPaid(uid: string, req: { amountPaise: number; upiId: string }) {
    if (!user) return
    setPayoutPending(true)
    setActionMsg(null)
    const res = await adminFetch(user, `/api/admin/influencers/${uid}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'mark-paid', appId, amountPaise: req.amountPaise, note: `UPI ${req.upiId}` }),
    })
    const data = await res.json().catch(() => ({}))
    setActionMsg(res.ok ? 'Payout recorded.' : (data.error ?? 'Payout failed.'))
    if (res.ok && openUid === uid) await openDetail(uid)
    setPayoutPending(false)
  }

  async function declineRequest(uid: string) {
    if (!user) return
    setPayoutPending(true)
    setActionMsg(null)
    const res = await adminFetch(user, `/api/admin/influencers/${uid}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'decline-payout', appId }),
    })
    const data = await res.json().catch(() => ({}))
    setActionMsg(res.ok ? 'Payout request declined.' : (data.error ?? 'Decline failed.'))
    if (res.ok && openUid === uid) await openDetail(uid)
    setPayoutPending(false)
  }

  const sorted = influencers
    ? [...influencers].sort((a, b) => {
        if (sortBy === 'applied-asc') return a.appliedAt - b.appliedAt
        if (sortBy === 'email-asc') return (a.email ?? a.uid).localeCompare(b.email ?? b.uid)
        return b.appliedAt - a.appliedAt
      })
    : null

  return (
    <div>
      {APPS.length > 1 ? (
        <div className="mb-4 flex gap-2 overflow-x-auto" role="group" aria-label="Select app">
          {APPS.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-pressed={appId === a.id}
              onClick={() => {
                setAppId(a.id)
                setOpenUid(null)
              }}
              className={`whitespace-nowrap rounded-full border-2 px-4 py-1.5 text-sm transition-colors ${
                appId === a.id
                  ? 'border-accent bg-accent-soft text-fg'
                  : 'border-line text-muted hover:border-line-strong hover:text-fg'
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
      ) : null}

      {configForm ? (
        <Card className="mb-4 rounded-2xl border-2 border-line-strong">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-40">
              <Input
                label="App discount %"
                type="number"
                min="0"
                max="90"
                value={configForm.discountPct}
                onChange={(e) => setConfigForm({ ...configForm, discountPct: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 pb-2">
              <input
                type="checkbox"
                checked={configForm.enabled}
                onChange={(e) => setConfigForm({ ...configForm, enabled: e.target.checked })}
                className="h-5 w-5 accent-accent"
              />
              <span className="font-mono text-xs uppercase tracking-[0.14em] text-fg">Partner codes enabled</span>
            </label>
            <Button size="sm" disabled={configPending} onClick={() => void saveConfig()}>
              {configPending ? 'Saving…' : 'Save app settings'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">
            The discount every approved promo code grants for this app. Commission is set per partner below.
          </p>
        </Card>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" role="group" aria-label="Filter by status">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((sVal) => (
            <button
              key={sVal}
              type="button"
              aria-pressed={statusFilter === sVal}
              onClick={() => setStatusFilter(sVal)}
              className={`rounded-full border-2 px-3 py-1 font-mono text-xs uppercase tracking-[0.12em] transition-colors ${
                statusFilter === sVal
                  ? 'border-accent bg-accent text-accent-fg'
                  : 'border-line text-muted hover:border-line-strong hover:text-fg'
              }`}
            >
              {sVal}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="inf-sort" className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Sort</label>
          <select
            id="inf-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="h-9 rounded-lg border border-line bg-card px-2 text-sm text-fg"
          >
            <option value="applied-desc">Applied · newest</option>
            <option value="applied-asc">Applied · oldest</option>
            <option value="email-asc">Email · A–Z</option>
          </select>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-500">
          Couldn't load influencers.
        </p>
      ) : !influencers ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading influencers">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-16 rounded-2xl border-2 border-line-strong" />
          ))}
        </div>
      ) : sorted!.length === 0 ? (
        <Card className="rounded-2xl border-2 border-line-strong text-center">
          <p className="text-sm text-muted">
            {statusFilter === 'all' ? 'No influencer applications yet.' : `No ${statusFilter} applications.`}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted!.map((inf) => (
            <Card key={inf.uid} className="rounded-2xl border-2 border-line-strong p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-display font-bold text-fg">{inf.email ?? inf.uid}</p>
                  <p className="mt-0.5 font-mono text-xs uppercase tracking-[0.1em] text-muted">
                    Applied {new Date(inf.appliedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    tone={inf.status === 'approved' ? 'success' : inf.status === 'pending' ? 'default' : 'warn'}
                  >
                    {inf.status}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => void openDetail(inf.uid)}>
                    {openUid === inf.uid ? 'Collapse' : 'Details'}
                  </Button>
                </div>
              </div>

              {openUid === inf.uid ? (
                <div className="mt-4 space-y-4 border-t border-line pt-4">
                  {actionMsg ? (
                    <p role={actionMsg.includes('failed') || actionMsg.includes('Error') ? 'alert' : 'status'} className={`font-mono text-xs uppercase tracking-[0.1em] ${actionMsg.includes('failed') || actionMsg.includes('Error') ? 'text-red-500' : 'text-accent'}`}>
                      {actionMsg}
                    </p>
                  ) : null}

                  {inf.status === 'pending' ? (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void decide(inf.uid, 'approved')}>
                        Approve
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setConfirmReject(inf.uid)}>
                        Reject
                      </Button>
                    </div>
                  ) : null}

                  {inf.status === 'approved' ? (
                    <>
                      {!ratesForm ? (
                        <div>
                          <p className="mb-1 font-mono text-xs uppercase tracking-[0.1em] text-muted">
                            Signup commission ₹{(inf.commissionRates.signupPaise / 100).toFixed(2)}
                          </p>
                          <p className="mb-2 font-mono text-xs uppercase tracking-[0.1em] text-muted">
                            Per-plan commission ·{' '}
                            {Object.keys(inf.commissionRates.perPlan).length === 0
                              ? 'none set'
                              : Object.entries(inf.commissionRates.perPlan)
                                  .map(([planId, paise]) => `${planId}: ₹${(paise / 100).toFixed(0)}`)
                                  .join(' · ')}
                          </p>
                          <Button size="sm" variant="outline" onClick={() => void startEditRates(inf)}>
                            Edit rates &amp; per-plan commission
                          </Button>
                          <div className="mt-4 border-t border-line pt-4">
                            <p className="mb-2 font-mono text-xs uppercase tracking-[0.1em] text-muted">
                              Promo code ·{' '}
                              {inf.promoCode ? (
                                <span className="text-accent">{inf.promoCode}</span>
                              ) : (
                                'not set'
                              )}
                            </p>
                            <div className="flex flex-wrap items-end gap-2">
                              <div className="w-44">
                                <Input
                                  label={inf.promoCode ? 'New code' : 'Assign code'}
                                  placeholder="e.g. NEHA20"
                                  value={codeForm}
                                  onChange={(e) => setCodeForm(e.target.value.toUpperCase())}
                                />
                              </div>
                              <Button size="sm" disabled={codePending || !codeForm.trim()} onClick={() => void submitCode(inf.uid)}>
                                {codePending ? 'Setting…' : inf.promoCode ? 'Change code' : 'Set code'}
                              </Button>
                            </div>
                            <p className="mt-2 text-xs text-muted">
                              Changing the code retires the old one immediately — links and codes already shared stop working.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <Input
                            label="Signup commission (₹)"
                            type="number"
                            min="0"
                            step="0.01"
                            value={(parseInt(ratesForm.signupPaise, 10) / 100).toFixed(2)}
                            onChange={(e) =>
                              setRatesForm({ ...ratesForm, signupPaise: String(Math.round(Number(e.target.value) * 100)) })
                            }
                          />
                          {plans?.map((p) => (
                            <Input
                              key={p.id}
                              label={`${p.id} commission (₹)`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={(parseInt(ratesForm.perPlan[p.id] || '0', 10) / 100).toFixed(2)}
                              onChange={(e) =>
                                setRatesForm({
                                  ...ratesForm,
                                  perPlan: {
                                    ...ratesForm.perPlan,
                                    [p.id]: String(Math.round(Number(e.target.value) * 100)),
                                  },
                                })
                              }
                            />
                          ))}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={ratesPending}
                              onClick={() => void submitRates(inf.uid)}
                            >
                              {ratesPending ? 'Saving…' : 'Save'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRatesForm(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : null}

                  {earnings ? (
                    <div className="border-t border-line pt-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Balance</p>
                          <p className="mt-1 font-display text-xl font-bold text-fg">{formatINR(earnings.balancePaise)}</p>
                        </div>
                        <div>
                          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Total earned</p>
                          <p className="mt-1 font-display text-xl font-bold text-fg">{formatINR(earnings.totalCommissionPaise)}</p>
                        </div>
                        <div>
                          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Paid out</p>
                          <p className="mt-1 font-display text-xl font-bold text-fg">{formatINR(earnings.paidPaise)}</p>
                        </div>
                      </div>

                      {earnings.payoutRequest ? (
                        <div className="mt-4 rounded-lg border-2 border-accent bg-accent-soft px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-mono text-xs uppercase tracking-[0.1em] text-fg">
                              Payout requested · {formatINR(earnings.payoutRequest.amountPaise)} ·{' '}
                              {new Date(earnings.payoutRequest.requestedAt).toLocaleDateString()}
                            </p>
                            <Button
                              size="sm"
                              disabled={payoutPending}
                              onClick={() =>
                                setConfirmPay({
                                  body: `Mark ${formatINR(earnings.payoutRequest.amountPaise)} paid to this partner? This reduces their balance and cannot be undone.`,
                                  run: () => void markRequestPaid(inf.uid, earnings.payoutRequest),
                                })
                              }
                            >
                              {payoutPending ? 'Processing…' : 'Mark paid'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={payoutPending}
                              onClick={() => void declineRequest(inf.uid)}
                            >
                              Decline
                            </Button>
                          </div>
                          <p className="mt-1 font-mono text-xs text-muted">
                            UPI · <span className="text-fg">{earnings.payoutRequest.upiId}</span>
                          </p>
                        </div>
                      ) : inf.status === 'approved' && earnings.balancePaise > 0 ? (
                        <div className="mt-4 border-t border-line pt-4">
                          <h4 className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-fg">Create payout request</h4>
                          <div className="flex flex-wrap items-end gap-2">
                            <div className="w-52">
                              <Input
                                label="Partner UPI ID"
                                placeholder="name@bank"
                                value={reqUpi}
                                onChange={(e) => setReqUpi(e.target.value)}
                              />
                            </div>
                            <Button size="sm" disabled={reqPending || !reqUpi.trim()} onClick={() => void createRequest(inf.uid)}>
                              {reqPending ? 'Creating…' : 'Create request'}
                            </Button>
                          </div>
                          <p className="mt-2 text-xs text-muted">
                            Raises a request for the full {formatINR(earnings.balancePaise)} balance on the partner’s behalf.
                          </p>
                        </div>
                      ) : null}

                      {inf.status === 'approved' ? (
                        <div className="mt-4 border-t border-line pt-4">
                          <h4 className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-fg">Mark payment</h4>
                          <div className="space-y-2">
                            <Input
                              label="Amount (₹)"
                              type="number"
                              min="0"
                              step="0.01"
                              value={payoutForm.amount}
                              onChange={(e) => setPayoutForm({ ...payoutForm, amount: e.target.value })}
                            />
                            <Input
                              label="Note (UPI, bank, etc.)"
                              type="text"
                              value={payoutForm.note}
                              onChange={(e) => setPayoutForm({ ...payoutForm, note: e.target.value })}
                            />
                            <Button
                              size="sm"
                              disabled={payoutPending || !payoutForm.amount}
                              onClick={() =>
                                setConfirmPay({
                                  body: `Mark ₹${payoutForm.amount} paid to this partner? This reduces their balance and cannot be undone.`,
                                  run: () => void submitPayout(inf.uid),
                                })
                              }
                            >
                              {payoutPending ? 'Processing…' : 'Mark paid'}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      {loadMoreError ? (
        <p role="alert" className="mt-4 text-center text-sm text-red-500">Couldn't load more influencers.</p>
      ) : null}
      {nextCursor ? (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}

      <ConfirmModal
        open={confirmReject !== null}
        title="Reject application?"
        body="The applicant can reapply later."
        confirmLabel="Yes, reject"
        onConfirm={() => void decide(confirmReject!, 'rejected')}
        onClose={() => setConfirmReject(null)}
        destructive
      />

      <ConfirmModal
        open={confirmPay !== null}
        title="Confirm payout"
        body={confirmPay?.body ?? ''}
        confirmLabel="Yes, mark paid"
        onConfirm={() => {
          confirmPay?.run()
          setConfirmPay(null)
        }}
        onClose={() => setConfirmPay(null)}
        destructive
      />
    </div>
  )
}
