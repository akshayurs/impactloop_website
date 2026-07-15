'use client'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Stat } from '@/components/ui/section'
import { formatINR } from '@/lib/format'
import { useAuth } from '@/lib/auth-context'
import { adminFetch } from './admin-fetch'

type Metrics = {
  totalRevenuePaise: number
  revenue30dPaise: number
  revenue7dPaise: number
  paymentCount: number
  recentPayments: Array<{ id: string; amountPaise: number; planId: string | null; appId: string | null; type: string | null; createdAt: number }>
  userCount: number
  newUsers7d: number
  subsByStatus: Record<string, number>
  subsByTier: Record<string, number>
  influencersByStatus: Record<string, number>
  commissionPaise: number
  paidOutPaise: number
  owedPaise: number
  webhookEventCount: number
  lastWebhookAt: number | null
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <p className="mt-8 border-b border-line pb-2 font-mono text-xs uppercase tracking-[0.18em] text-muted first:mt-0">{children}</p>
}

export function AdminOverview() {
  const { user } = useAuth()
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setError(false)
    try {
      const res = await adminFetch(user, '/api/admin/metrics')
      if (!res.ok) throw new Error('metrics failed')
      setMetrics(await res.json())
    } catch {
      setError(true)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  if (error) {
    return (
      <Card className="rounded-2xl border-2 border-line-strong">
        <p role="alert" className="text-sm text-red-500">Couldn&rsquo;t load metrics.</p>
        <div className="mt-4"><Button variant="outline" size="sm" onClick={() => void load()}>Retry</Button></div>
      </Card>
    )
  }
  if (!metrics) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="Loading metrics">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-2xl border-2 border-line-strong" />
        ))}
      </div>
    )
  }

  const subs = metrics.subsByStatus
  const paying = (subs.active ?? 0) + (subs.lifetime ?? 0)

  return (
    <div>
      <GroupLabel>Revenue</GroupLabel>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="All time" value={formatINR(metrics.totalRevenuePaise)} highlight />
        <Stat label="Last 30 days" value={formatINR(metrics.revenue30dPaise)} />
        <Stat label="Last 7 days" value={formatINR(metrics.revenue7dPaise)} />
        <Stat label="Payments" value={String(metrics.paymentCount)} />
      </div>

      <GroupLabel>Users &amp; subscriptions</GroupLabel>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Users" value={String(metrics.userCount)} />
        <Stat label="New · 7d" value={`+${metrics.newUsers7d}`} />
        <Stat label="Paying" value={String(paying)} highlight />
        <Stat label="Trials" value={String(subs.trial ?? 0)} />
        <Stat label="Cancelled" value={String(subs.cancelled ?? 0)} />
        <Stat label="Expired" value={String((subs.expired ?? 0) + (subs.revoked ?? 0))} />
      </div>
      {Object.keys(metrics.subsByTier).length > 0 ? (
        <p className="mt-2 font-mono text-xs uppercase tracking-[0.12em] text-muted">
          paying by tier ·{' '}
          {Object.entries(metrics.subsByTier)
            .map(([tier, n]) => `${tier}: ${n}`)
            .join(' · ')}
        </p>
      ) : null}

      <GroupLabel>Partner program</GroupLabel>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Pending review"
          value={String(metrics.influencersByStatus.pending ?? 0)}
          highlight={(metrics.influencersByStatus.pending ?? 0) > 0}
        />
        <Stat label="Approved partners" value={String(metrics.influencersByStatus.approved ?? 0)} />
        <Stat label="Commission earned" value={formatINR(metrics.commissionPaise)} />
        <Stat label="Owed to partners" value={formatINR(metrics.owedPaise)} />
      </div>

      <GroupLabel>Recent payments</GroupLabel>
      {metrics.recentPayments.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No payments yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-2xl border-2 border-line-strong bg-card px-4">
          {metrics.recentPayments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="truncate font-mono text-xs text-muted">
                {new Date(p.createdAt).toLocaleString()} · {p.appId ?? '—'} · {p.planId ?? p.type ?? '—'}
              </span>
              <span className="shrink-0 font-display font-semibold text-fg">{formatINR(p.amountPaise)}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 font-mono text-xs uppercase tracking-[0.12em] text-muted">
        Webhooks · {metrics.webhookEventCount} events
        {metrics.lastWebhookAt ? ` · last ${new Date(metrics.lastWebhookAt).toLocaleString()}` : ' · none received yet'}
      </p>
    </div>
  )
}
