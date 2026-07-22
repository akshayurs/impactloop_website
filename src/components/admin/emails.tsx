'use client'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth-context'
import { adminFetch } from './admin-fetch'

type Status = { configured: boolean; enabled: boolean; from: string | null }
type Influencer = { uid: string; email: string | null; promoCode: string | null }
type Audience = 'users' | 'influencers'

export function AdminEmails() {
  const { user } = useAuth()
  const [status, setStatus] = useState<Status | null>(null)
  const [influencers, setInfluencers] = useState<Influencer[]>([])
  const [audience, setAudience] = useState<Audience>('users')
  const [selectAllInfluencers, setSelectAllInfluencers] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [ctaLabel, setCtaLabel] = useState('')
  const [ctaUrl, setCtaUrl] = useState('')
  const [busy, setBusy] = useState<'test' | 'send' | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    const [statusRes, infRes] = await Promise.all([
      adminFetch(user, '/api/admin/email'),
      adminFetch(user, '/api/admin/influencers?status=approved'),
    ])
    if (statusRes.ok) setStatus(await statusRes.json())
    if (infRes.ok) setInfluencers(((await infRes.json()).influencers ?? []).filter((i: Influencer) => i.email))
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  function toggle(uid: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  async function submit(action: 'test' | 'send') {
    if (!user) return
    setBusy(action)
    setMsg(null)
    setConfirming(false)
    try {
      const res = await adminFetch(user, '/api/admin/email', {
        method: 'POST',
        body: JSON.stringify({
          action: action === 'test' ? 'test' : 'send',
          audience,
          uids: audience === 'influencers' && !selectAllInfluencers ? [...selected] : undefined,
          subject,
          message,
          ctaLabel: ctaLabel || undefined,
          ctaUrl: ctaUrl || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setMsg(data.error ?? 'Failed.')
      else if (action === 'test') setMsg('Test email sent to your inbox.')
      else setMsg(`Done — sent ${data.sent}/${data.total} (skipped ${data.skipped} unsubscribed, ${data.failed} failed).`)
    } finally {
      setBusy(null)
    }
  }

  const audienceCount =
    audience === 'users' ? 'all users' : selectAllInfluencers ? `all ${influencers.length} partners` : `${selected.size} partner(s)`
  const canSend = subject.trim().length > 0 && message.trim().length > 0 && !busy
  const labelCls = 'font-mono text-xs uppercase tracking-[0.18em] text-fg'

  return (
    <div className="max-w-2xl space-y-4">
      {status ? (
        <Card className="rounded-2xl border-2 border-line-strong">
          <p className={labelCls}>Delivery status</p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <span className={status.configured ? 'text-green-600' : 'text-red-500'}>
              {status.configured ? '● Gmail configured' : '● Gmail not configured — set GMAIL_USER, GMAIL_APP_PASSWORD, EMAIL_UNSUB_SECRET'}
            </span>
            <span className={status.enabled ? 'text-green-600' : 'text-red-500'}>
              {status.enabled ? '● Sending enabled' : '● Sending disabled (Settings → Emails enabled)'}
            </span>
            {status.from ? <span className="text-muted">From: {status.from}</span> : null}
          </div>
          <p className="mt-2 text-xs text-muted">Gmail caps sending at ~500 emails/day — large blasts may need multiple days.</p>
        </Card>
      ) : null}

      <Card className="rounded-2xl border-2 border-line-strong">
        <p className={labelCls}>Compose broadcast</p>

        <div className="mt-4 flex gap-2">
          {(
            [
              ['users', 'All users'],
              ['influencers', 'Influencers'],
            ] as Array<[Audience, string]>
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setAudience(val)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                audience === val ? 'border-accent/50 bg-accent-soft text-fg' : 'border-line text-muted hover:text-fg'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {audience === 'influencers' ? (
          <div className="mt-4 rounded-xl border border-line p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectAllInfluencers}
                onChange={(e) => setSelectAllInfluencers(e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              All approved partners ({influencers.length})
            </label>
            {!selectAllInfluencers ? (
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto border-t border-line pt-2">
                {influencers.map((inf) => (
                  <label key={inf.uid} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.has(inf.uid)}
                      onChange={() => toggle(inf.uid)}
                      className="h-4 w-4 accent-accent"
                    />
                    <span>{inf.email}</span>
                    {inf.promoCode ? <span className="font-mono text-xs text-muted">({inf.promoCode})</span> : null}
                  </label>
                ))}
                {influencers.length === 0 ? <p className="text-sm text-muted">No approved partners with an email.</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 space-y-4">
          <Input label="Subject" maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="New: CrackLoop AI plan is here" />
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-xs uppercase tracking-[0.1em] text-muted">Message</span>
            <textarea
              value={message}
              maxLength={5000}
              onChange={(e) => setMessage(e.target.value)}
              rows={7}
              placeholder={'Write the email body. Blank lines start a new paragraph.'}
              className="rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg placeholder:text-muted transition-colors focus:border-2 focus:border-accent focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Button label (optional)" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="See the new plan" />
            <Input label="Button link (optional)" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://…" />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button size="sm" variant="outline" disabled={!canSend} onClick={() => void submit('test')}>
            {busy === 'test' ? 'Sending…' : 'Send test to me'}
          </Button>
          {confirming ? (
            <>
              <Button size="sm" variant="danger" disabled={!canSend} onClick={() => void submit('send')}>
                {busy === 'send' ? 'Sending…' : `Confirm send to ${audienceCount}`}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button size="sm" disabled={!canSend || (audience === 'influencers' && !selectAllInfluencers && selected.size === 0)} onClick={() => setConfirming(true)}>
              Send to {audienceCount}
            </Button>
          )}
          {msg ? (
            <p role="status" className="font-mono text-xs uppercase tracking-[0.1em] text-muted">
              {msg}
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  )
}
