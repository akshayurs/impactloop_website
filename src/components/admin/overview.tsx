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
  paymentCount: number
  userCount: number
  activeSubscriptionCount: number
  webhookEventCount: number
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
        <p role="alert" className="text-sm text-red-500">Couldn't load metrics.</p>
        <div className="mt-4"><Button variant="outline" size="sm" onClick={() => void load()}>Retry</Button></div>
      </Card>
    )
  }
  if (!metrics) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-busy="true" aria-label="Loading metrics">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-24 rounded-2xl border-2 border-line-strong" />
        ))}
      </div>
    )
  }

  const stats = [
    { label: 'Revenue', value: formatINR(metrics.totalRevenuePaise) },
    { label: 'Payments', value: String(metrics.paymentCount) },
    { label: 'Users', value: String(metrics.userCount) },
    { label: 'Subscriptions created', value: String(metrics.activeSubscriptionCount) },
    { label: 'Webhook events', value: String(metrics.webhookEventCount) },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((s) => (
        <Stat key={s.label} label={s.label} value={s.value} />
      ))}
    </div>
  )
}
