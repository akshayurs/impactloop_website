'use client'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmModal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { formatINR } from '@/lib/format'
import { useAuth } from '@/lib/auth-context'
import { adminFetch } from './admin-fetch'

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
  const [influencers, setInfluencers] = useState<InfluencerRow[] | null>(null)
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [error, setError] = useState(false)
  const [openUid, setOpenUid] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [earnings, setEarnings] = useState<any | null>(null)
  const [payoutForm, setPayoutForm] = useState({ amount: '', note: '' })
  const [payoutPending, setPayoutPending] = useState(false)
  const [confirmReject, setConfirmReject] = useState<string | null>(null)
  const [ratesForm, setRatesForm] = useState<{
    discountPct: string
    signupPaise: string
    perPlan: Record<string, string>
  } | null>(null)
  const [ratesPending, setRatesPending] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setError(false)
    try {
      const res = await adminFetch(user, '/api/admin/influencers')
      if (!res.ok) throw new Error('failed')
      setInfluencers((await res.json()).influencers)
      const plansRes = await adminFetch(user, '/api/admin/plans')
      if (plansRes.ok) {
        const allPlans = (await plansRes.json()).plans
        setPlans(allPlans.filter((p: any) => p.active))
      }
    } catch {
      setError(true)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  async function openDetail(uid: string) {
    setOpenUid(uid)
    setActionMsg(null)
    setEarnings(null)
    setPayoutForm({ amount: '', note: '' })
    setRatesForm(null)
    const res = await adminFetch(user!, '/api/admin/influencers/' + uid, {
      method: 'POST',
      body: JSON.stringify({ action: 'earnings' }),
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
      body: JSON.stringify({ action: decision }),
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
      discountPct: String(inf.discountPct),
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
        discountPct: parseInt(ratesForm.discountPct, 10),
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

  async function submitPayout(uid: string) {
    if (!user) return
    setPayoutPending(true)
    setActionMsg(null)
    const amountPaise = Math.round(Number(payoutForm.amount) * 100)
    const res = await adminFetch(user, `/api/admin/influencers/${uid}`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'mark-paid',
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

  return (
    <div>
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
      ) : influencers.length === 0 ? (
        <Card className="rounded-2xl border-2 border-line-strong text-center">
          <p className="text-sm text-muted">No influencer applications yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {influencers.map((inf) => (
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
                          <p className="mb-2 font-mono text-xs uppercase tracking-[0.1em] text-muted">
                            Discount {inf.discountPct}% · Signup ₹{(inf.commissionRates.signupPaise / 100).toFixed(2)}
                          </p>
                          <Button size="sm" variant="outline" onClick={() => void startEditRates(inf)}>
                            Edit rates
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <Input
                            label="Discount %"
                            type="number"
                            min="0"
                            max="90"
                            value={ratesForm.discountPct}
                            onChange={(e) => setRatesForm({ ...ratesForm, discountPct: e.target.value })}
                          />
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
                              onClick={() => void submitPayout(inf.uid)}
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

      <ConfirmModal
        open={confirmReject !== null}
        title="Reject application?"
        body="The applicant can reapply later."
        confirmLabel="Yes, reject"
        onConfirm={() => void decide(confirmReject!, 'rejected')}
        onClose={() => setConfirmReject(null)}
        destructive
      />
    </div>
  )
}
