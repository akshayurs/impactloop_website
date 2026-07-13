'use client'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'

export default function AuthButton() {
  const { user, loading, signIn, signOutUser } = useAuth()
  if (loading) return null
  if (!user)
    return (
      <button onClick={() => signIn()} className="rounded-full border border-white/20 px-4 py-1.5 text-sm hover:bg-white/10">
        Sign in
      </button>
    )
  return (
    <div className="flex items-center gap-3 text-sm">
      <Link href="/account" className="hover:underline">Account</Link>
      <button onClick={() => signOutUser()} className="rounded-full border border-white/20 px-4 py-1.5 hover:bg-white/10">
        Sign out
      </button>
    </div>
  )
}
