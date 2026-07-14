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

  if (loading) return <p className="px-4 py-16 text-center text-muted">Loading…</p>
  if (!user) {
    return (
      <Card className="mx-auto mt-16 max-w-sm text-center">
        <p className="text-sm text-muted">Admin area</p>
        <div className="mt-4">
          <Button onClick={() => void signIn()}>Sign in</Button>
        </div>
      </Card>
    )
  }
  if (state === 'checking') return <p className="px-4 py-16 text-center text-muted">Checking access…</p>
  if (state === 'forbidden') {
    return (
      <Card className="mx-auto mt-16 max-w-sm text-center">
        <p className="font-medium text-fg">Not authorized</p>
        <p className="mt-2 text-sm text-muted">This area is for administrators.</p>
        <div className="mt-4">
          <Button href="/" variant="outline" size="sm">Back home</Button>
        </div>
      </Card>
    )
  }
  if (state === 'error') {
    return (
      <Card className="mx-auto mt-16 max-w-sm text-center">
        <p role="alert" className="text-sm text-red-500">Couldn't check access.</p>
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={() => setAttempt((a) => a + 1)}>Retry</Button>
        </div>
      </Card>
    )
  }
  return <>{children}</>
}
