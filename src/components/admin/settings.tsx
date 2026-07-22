'use client'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EMAIL_TOGGLES, type EmailToggleKey } from '@/lib/server/email/registry'
import { useAuth } from '@/lib/auth-context'
import { adminFetch } from './admin-fetch'

type Settings = {
  freeTrialEnabled: boolean
  trialDays: number
  promoDefaultExpiryMonths: number
  emailEnabled: boolean
  emailExpiryReminderDays: number
  minPayoutPaise: number
} & Record<EmailToggleKey, boolean>

export function AdminSettings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    const res = await adminFetch(user, '/api/admin/settings')
    if (res.ok) setSettings(await res.json())
    else setMsg('Failed to load settings.')
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    if (!user || !settings) return
    setSaving(true)
    setMsg(null)
    try {
      const res = await adminFetch(user, '/api/admin/settings', { method: 'PUT', body: JSON.stringify(settings) })
      const data = await res.json().catch(() => ({}))
      setMsg(res.ok ? 'Saved.' : (data.error ?? 'Save failed.'))
      if (res.ok) setSettings(data)
    } finally {
      setSaving(false)
    }
  }

  if (!settings) {
    return (
      <div className="max-w-md space-y-3" aria-busy="true" aria-label="Loading settings">
        <div className="skeleton h-24 rounded-2xl border-2 border-line-strong" />
        <div className="skeleton h-16 rounded-2xl border-2 border-line-strong" />
        <div className="skeleton h-16 rounded-2xl border-2 border-line-strong" />
        {msg ? <p role="alert" className="text-sm text-red-500">{msg}</p> : null}
      </div>
    )
  }

  return (
    <Card className="max-w-md rounded-2xl border-2 border-line-strong">
      <label className="flex items-center justify-between gap-4">
        <span className="font-mono text-xs uppercase tracking-[0.18em] text-fg">Free trials enabled</span>
        <input
          type="checkbox"
          checked={settings.freeTrialEnabled}
          onChange={(e) => setSettings({ ...settings, freeTrialEnabled: e.target.checked })}
          className="h-5 w-5 accent-accent"
        />
      </label>
      <div className="mt-4 border-t border-line pt-4">
        <Input
          label="Trial length (days)"
          type="number"
          min={1}
          max={365}
          value={settings.trialDays}
          onChange={(e) => setSettings({ ...settings, trialDays: Number(e.target.value) })}
        />
      </div>
      <div className="mt-4">
        <Input
          label="Promo code default expiry (months)"
          type="number"
          min={1}
          max={24}
          value={settings.promoDefaultExpiryMonths}
          onChange={(e) => setSettings({ ...settings, promoDefaultExpiryMonths: Number(e.target.value) })}
        />
      </div>
      <div className="mt-4">
        <Input
          label="Minimum payout (₹)"
          type="number"
          min={0}
          step={1}
          value={settings.minPayoutPaise / 100}
          onChange={(e) => setSettings({ ...settings, minPayoutPaise: Math.round(Number(e.target.value) * 100) })}
        />
        <p className="mt-1.5 text-xs text-muted">Partners can request a payout once their balance reaches this amount.</p>
      </div>
      <div className="mt-6 border-t-2 border-line-strong pt-4">
        <label className="flex items-center justify-between gap-4">
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-fg">Emails enabled</span>
          <input
            type="checkbox"
            checked={settings.emailEnabled}
            onChange={(e) => setSettings({ ...settings, emailEnabled: e.target.checked })}
            className="h-5 w-5 accent-accent"
          />
        </label>
        <div className={settings.emailEnabled ? 'mt-3 space-y-3' : 'mt-3 space-y-3 opacity-50'}>
          {EMAIL_TOGGLES.map((t) => (
            <label key={t.key} className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted">{t.label}</span>
              <input
                type="checkbox"
                checked={Boolean(settings[t.key])}
                onChange={(e) => setSettings({ ...settings, [t.key]: e.target.checked })}
                className="h-4 w-4 accent-accent"
              />
            </label>
          ))}
          <Input
            label="Remind before expiry (days)"
            type="number"
            min={1}
            max={30}
            value={settings.emailExpiryReminderDays}
            onChange={(e) => setSettings({ ...settings, emailExpiryReminderDays: Number(e.target.value) })}
          />
        </div>
      </div>
      <div className="mt-6 flex items-center gap-3 border-t border-line pt-4">
        <Button size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
        {msg ? <p role="status" className="font-mono text-xs uppercase tracking-[0.1em] text-muted">{msg}</p> : null}
      </div>
    </Card>
  )
}
