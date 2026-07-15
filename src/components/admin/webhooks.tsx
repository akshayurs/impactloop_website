'use client'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table } from '@/components/ui/table'
import { useAuth } from '@/lib/auth-context'
import { adminFetch } from './admin-fetch'

type Event = { id: string; event: string; receivedAt: number }

export function AdminWebhooks() {
  const { user } = useAuth()
  const [events, setEvents] = useState<Event[] | null>(null)
  const [error, setError] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setError(false)
    setLoadMoreError(false)
    try {
      const res = await adminFetch(user, '/api/admin/webhooks')
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setEvents(data.events)
      setNextCursor(data.nextCursor ?? null)
    } catch {
      setError(true)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  async function loadMore() {
    if (!user || !nextCursor) return
    setLoadingMore(true)
    setLoadMoreError(false)
    try {
      const res = await adminFetch(user, `/api/admin/webhooks?cursor=${encodeURIComponent(nextCursor)}`)
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setEvents((prev) => {
        const existing = new Set((prev ?? []).map((e) => e.id))
        const additions = (data.events as Event[]).filter((e) => !existing.has(e.id))
        return [...(prev ?? []), ...additions]
      })
      setNextCursor(data.nextCursor ?? null)
    } catch {
      setLoadMoreError(true)
    } finally {
      setLoadingMore(false)
    }
  }

  if (error) {
    return (
      <Card className="rounded-2xl border-2 border-line-strong">
        <p role="alert" className="text-sm text-red-500">Couldn't load events.</p>
        <div className="mt-4"><Button variant="outline" size="sm" onClick={() => void load()}>Retry</Button></div>
      </Card>
    )
  }
  if (!events) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading webhook events">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-11 rounded-lg" />
        ))}
      </div>
    )
  }
  if (events.length === 0) {
    return (
      <Card className="rounded-2xl border-2 border-line-strong text-center">
        <p className="text-sm text-muted">No webhook events yet. They'll show up here as Razorpay sends them.</p>
      </Card>
    )
  }

  return (
    <div>
      <Table head={['Event', 'Received', 'Key']}>
        {events.map((e) => (
          <tr key={e.id} className="hover:bg-bg-raised">
            <td className="px-4 py-3 font-mono text-xs uppercase tracking-[0.1em] text-fg">{e.event}</td>
            <td className="px-4 py-3 text-muted">{new Date(e.receivedAt).toLocaleString()}</td>
            <td className="px-4 py-3 font-mono text-xs text-muted">{e.id}</td>
          </tr>
        ))}
      </Table>

      {loadMoreError ? (
        <p role="alert" className="mt-4 text-center text-sm text-red-500">Couldn't load more events.</p>
      ) : null}
      {nextCursor ? (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
