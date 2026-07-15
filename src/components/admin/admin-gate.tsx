'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/lib/auth-context'
import { adminFetch } from './admin-fetch'

type GateState = 'checking' | 'allowed' | 'forbidden' | 'error'

export function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, loading, signIn } = useAuth()
  const [state, setState] = useState<GateState>('checking')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (loading || !user) return
    let cancelled = false
    setState('checking')
    adminFetch(user, '/api/admin/settings')
      .then((res) => {
        if (cancelled) return
        setState(res.ok ? 'allowed' : res.status === 403 ? 'forbidden' : 'error')
      })
      .catch(() => !cancelled && setState('error'))
    return () => {
      cancelled = true
    }
  }, [user, loading, attempt])

  if (loading) {
    return (
      <div className="mx-auto mt-16 max-w-sm space-y-3" aria-busy="true" aria-label="Loading">
        <div className="skeleton h-4 w-32 rounded" />
        <div className="skeleton h-24 rounded-2xl border-2 border-line-strong" />
      </div>
    )
  }
  if (!user) {
    return (
      <Card className="mx-auto mt-16 max-w-sm rounded-2xl border-2 border-line-strong text-center">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Admin area</p>
        <div className="mt-4">
          <Button onClick={() => void signIn()}>Sign in</Button>
        </div>
      </Card>
    )
  }
  if (state === 'checking') {
    return (
      <div className="mx-auto mt-16 max-w-sm space-y-3" aria-busy="true" aria-label="Checking access">
        <div className="skeleton h-4 w-40 rounded" />
        <div className="skeleton h-24 rounded-2xl border-2 border-line-strong" />
      </div>
    )
  }
  if (state === 'forbidden') {
    return (
      <Card className="mx-auto mt-16 max-w-sm rounded-2xl border-2 border-line-strong text-center">
        <p className="font-display text-lg font-bold text-fg">Not authorized</p>
        <p className="mt-2 text-sm text-muted">This area is for administrators.</p>
        <div className="mt-4">
          <Button href="/" variant="outline" size="sm">Back home</Button>
        </div>
      </Card>
    )
  }
  if (state === 'error') {
    return (
      <Card className="mx-auto mt-16 max-w-sm rounded-2xl border-2 border-line-strong text-center">
        <p role="alert" className="text-sm text-red-500">Couldn't check access.</p>
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={() => setAttempt((a) => a + 1)}>Retry</Button>
        </div>
      </Card>
    )
  }
  return <>{children}</>
}
