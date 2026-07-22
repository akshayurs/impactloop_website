'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getApp } from '@/config/apps'
import { formatINR } from '@/lib/format'
import { useAuth } from '@/lib/auth-context'

type Receipt = {
  paymentId: string
  email: string | null
  amountPaise: number | null
  planId: string | null
  appId: string | null
  type: string | null
  createdAt: number | null
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-fg">{value}</span>
    </div>
  )
}

export default function ReceiptPage() {
  const { user, loading, signIn } = useAuth()
  const params = useParams<{ paymentId: string }>()
  const paymentId = params.paymentId
  const [data, setData] = useState<Receipt | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    void (async () => {
      try {
        const token = await user.getIdToken()
        const res = await fetch(`/api/me/receipt/${paymentId}`, { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) return setError(res.status === 404 ? 'Receipt not found.' : 'Could not load this receipt.')
        setData(await res.json())
      } catch {
        setError('Could not load this receipt.')
      }
    })()
  }, [user, paymentId])

  if (loading) return <div className="mx-auto max-w-lg px-6 py-24 text-center text-muted">Loading…</div>

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-fg">Sign in to view your receipt</h1>
        <button
          type="button"
          onClick={() => void signIn()}
          className="mt-6 rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-fg hover:bg-accent-strong"
        >
          Sign in with Google
        </button>
      </div>
    )
  }

  if (error) return <div className="mx-auto max-w-lg px-6 py-24 text-center text-muted">{error}</div>
  if (!data) return <div className="mx-auto max-w-lg px-6 py-24 text-center text-muted">Loading…</div>

  const appName = data.appId ? (getApp(data.appId)?.name ?? data.appId) : '—'
  const date = data.createdAt ? new Date(data.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
  const amount = typeof data.amountPaise === 'number' ? formatINR(data.amountPaise) : '—'

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <div className="rounded-2xl border-2 border-line-strong bg-card p-8">
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-bold text-fg">Impact Loop</p>
          <span className="rounded-full bg-accent-soft px-3 py-1 font-mono text-xs uppercase tracking-[0.18em] text-accent">Receipt</span>
        </div>

        <div className="mt-6 space-y-1 border-t border-line pt-4">
          <Line label="Receipt no." value={data.paymentId} />
          <Line label="Date" value={date} />
          <Line label="Billed to" value={data.email ?? '—'} />
        </div>

        <div className="mt-4 space-y-1 border-t border-line pt-4">
          <Line label="Item" value={`${appName} — ${data.planId ?? 'plan'}${data.type ? ` (${data.type})` : ''}`} />
        </div>

        <div className="mt-4 flex justify-between border-t-2 border-line-strong pt-4">
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Total paid</span>
          <span className="font-display text-2xl font-bold text-fg">{amount}</span>
        </div>

        <p className="mt-6 text-xs text-muted">
          Paid to Impact Loop via Razorpay. This is a payment receipt, not a GST tax invoice —
          Impact Loop is not GST-registered. Questions? {' '}
          <a className="text-accent underline" href="mailto:impactloopapps@gmail.com">impactloopapps@gmail.com</a>.
        </p>
      </div>

      <div className="mt-6 flex justify-center print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full border-2 border-line px-5 py-2 text-sm text-fg hover:border-line-strong"
        >
          Print / save as PDF
        </button>
      </div>
    </div>
  )
}
