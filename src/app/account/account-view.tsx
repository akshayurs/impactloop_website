'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/lib/auth-context'

export function AccountView() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/')
  }, [loading, user, router])

  if (loading || !user) {
    return <p className="px-4 py-16 text-center text-muted">Loading…</p>
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-fg">Account</h1>
      <Card className="mt-8">
        <p className="text-sm text-muted">Signed in as</p>
        <p className="mt-1 font-medium text-fg">{user.displayName ?? user.email}</p>
        <p className="text-sm text-muted">{user.email}</p>
        <div className="mt-6">
          <Button variant="outline" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </Card>
      <Card className="mt-6">
        <h2 className="font-display text-lg font-semibold text-fg">Subscriptions</h2>
        <p className="mt-2 text-sm text-muted">
          Your subscriptions will appear here once checkout goes live.
        </p>
      </Card>
    </div>
  )
}
