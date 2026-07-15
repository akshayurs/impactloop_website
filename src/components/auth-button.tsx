'use client'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { Button } from './ui/button'

export function AuthButton() {
  const { user, loading, signIn } = useAuth()
  if (loading) return <div className="h-8 w-20 animate-pulse rounded-full bg-card" aria-hidden />
  if (!user) {
    return (
      <Button size="sm" onClick={() => void signIn()}>
        Sign in
      </Button>
    )
  }
  return (
    <Link href="/account" className="text-sm text-muted hover:text-fg">
      Account
    </Link>
  )
}
