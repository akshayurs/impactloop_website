'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { listApps } from '@/config/apps'

export default function AccountView() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/')
  }, [loading, user, router])

  if (loading || !user) return <main className="min-h-screen bg-ink text-white grid place-items-center">Loading…</main>

  return (
    <main className="min-h-screen bg-ink text-white px-6 py-16">
      <div className="mx-auto max-w-content">
        <h1 className="font-display text-3xl mb-2">Your account</h1>
        <p className="text-white/60 mb-10">{user.displayName} · {user.email}</p>
        <h2 className="font-display text-xl mb-4">Apps</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listApps().map((app) => (
            <div key={app.appId} className="rounded-2xl border border-white/10 p-5" style={{ background: `${app.theme.primary}14` }}>
              <div className="font-display text-lg">{app.displayName}</div>
              <div className="text-white/50 text-sm mt-1">No active subscription</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
