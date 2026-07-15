'use client'
import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export function ReferralCatcher() {
  const { user } = useAuth()

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref) {
      document.cookie = `il_ref=${encodeURIComponent(ref)}; max-age=2592000; path=/; SameSite=Lax`
    }
  }, [])

  useEffect(() => {
    if (!user) return
    const code = getCookie('il_ref')
    if (!code) return
    void (async () => {
      try {
        const token = await user.getIdToken()
        await fetch('/api/referral/claim', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })
      } finally {
        document.cookie = 'il_ref=; max-age=0; path=/'
      }
    })()
  }, [user])

  return null
}
