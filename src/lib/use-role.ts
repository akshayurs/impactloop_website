'use client'
import { useEffect, useState } from 'react'
import { useAuth } from './auth-context'
import { MOCK_ROLE } from './mock'

export type Role = 'admin' | 'influencer' | 'user'

/** Resolves the signed-in user's dashboard role: admin > influencer > user. */
export function useRole(): { role: Role | null; loading: boolean } {
  const { user, loading } = useAuth()
  const [role, setRole] = useState<Role | null>(null)
  const [resolving, setResolving] = useState(false)

  useEffect(() => {
    if (MOCK_ROLE) {
      setRole(MOCK_ROLE)
      return
    }
    if (loading) return
    if (!user) {
      setRole(null)
      return
    }
    let cancelled = false
    setResolving(true)
    void (async () => {
      try {
        const tokenResult = await user.getIdTokenResult()
        if (tokenResult.claims.admin === true) {
          if (!cancelled) setRole('admin')
          return
        }
        const res = await fetch('/api/influencer/me', {
          headers: { Authorization: `Bearer ${tokenResult.token}` },
        })
        if (res.ok) {
          const data = await res.json()
          const approved =
            Array.isArray(data.apps) && data.apps.some((a: { status?: string }) => a.status === 'approved')
          if (approved) {
            if (!cancelled) setRole('influencer')
            return
          }
        }
        if (!cancelled) setRole('user')
      } catch {
        if (!cancelled) setRole('user')
      } finally {
        if (!cancelled) setResolving(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, loading])

  return { role, loading: loading || resolving }
}

export const DASHBOARD_PATH: Record<Role, string> = {
  admin: '/admin',
  influencer: '/influencer',
  user: '/account',
}
