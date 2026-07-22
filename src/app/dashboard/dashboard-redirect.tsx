'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/lib/auth-context'
import { DASHBOARD_PATH, useRole } from '@/lib/use-role'

export function DashboardRedirect() {
  const { user, loading, signIn } = useAuth()
  const { role } = useRole()
  const router = useRouter()

  useEffect(() => {
    if (role) router.replace(DASHBOARD_PATH[role])
  }, [role, router])

  if (!loading && !user) {
    return (
      <Card className="mx-auto mt-16 max-w-sm text-center">
        <p className="kicker justify-center">Dashboard</p>
        <p className="mt-4 text-sm text-muted">Sign in to open your dashboard.</p>
        <div className="mt-6">
          <Button onClick={() => void signIn()}>Sign in</Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-sm space-y-3 py-16" aria-busy="true" aria-label="Opening your dashboard">
      <div className="skeleton h-4 w-32 rounded" />
      <div className="skeleton h-24 rounded-2xl" />
    </div>
  )
}
