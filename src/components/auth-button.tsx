'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Button } from './ui/button'

export function AuthButton() {
  const { user, loading, signIn } = useAuth()
  const router = useRouter()
  if (loading) return <div className="skeleton h-8 w-20 rounded-full" aria-hidden />
  if (!user) {
    return (
      <Button
        size="sm"
        onClick={() => {
          void (async () => {
            await signIn()
            router.push('/dashboard')
          })()
        }}
      >
        Sign in
      </Button>
    )
  }
  return (
    <Link href="/dashboard" className="font-mono text-xs uppercase tracking-[0.1em] text-muted hover:text-fg">
      Dashboard
    </Link>
  )
}
