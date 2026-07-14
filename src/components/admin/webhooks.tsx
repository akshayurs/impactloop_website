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

  const load = useCallback(async () => {
    if (!user) return
    setError(false)
    try {
      const res = await adminFetch(user, '/api/admin/webhooks')
      if (!res.ok) throw new Error('failed')
      setEvents((await res.json()).events)
    } catch {
      setError(true)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  if (error) {
    return (
      <Card>
        <p role="alert" className="text-sm text-red-500">Couldn't load events.</p>
        <div className="mt-4"><Button variant="outline" size="sm" onClick={() => void load()}>Retry</Button></div>
      </Card>
    )
  }
  if (!events) return <p className="text-sm text-muted">Loading…</p>
  if (events.length === 0) return <p className="text-sm text-muted">No webhook events yet.</p>

  return (
    <Table head={['Event', 'Received', 'Key']}>
      {events.map((e) => (
        <tr key={e.id}>
          <td className="px-4 py-3 text-fg">{e.event}</td>
          <td className="px-4 py-3 text-muted">{new Date(e.receivedAt).toLocaleString()}</td>
          <td className="px-4 py-3 font-mono text-xs text-muted">{e.id}</td>
        </tr>
      ))}
    </Table>
  )
}
