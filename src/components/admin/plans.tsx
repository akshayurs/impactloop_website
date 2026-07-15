'use client'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmModal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { formatINR } from '@/lib/format'
import { APPS } from '@/config/apps'
import type { TierContent } from '@/config/tiers'
import { useAuth } from '@/lib/auth-context'
import { adminFetch } from './admin-fetch'

type PlanRow = {
  id: string; appId: string; tier: 'pro' | 'ai'; durationMonths: number | null; lifetime: boolean
  pricePaise: number; playStorePricePaise: number | null; active: boolean; sort: number; razorpayPlanId: string | null
}

const DURATIONS = [
  { label: '1 month', months: 1 }, { label: '3 months', months: 3 },
  { label: '6 months', months: 6 }, { label: '12 months', months: 12 },
  { label: 'Lifetime', months: null },
] as const

export function AdminPlans() {
  const { user } = useAuth()
  const [plans, setPlans] = useState<PlanRow[] | null>(null)
  const [error, setError] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [deactivate, setDeactivate] = useState<string | null>(null)
  const [form, setForm] = useState({ id: '', appId: APPS[0]?.id ?? '', tier: 'pro' as 'pro' | 'ai', duration: '1', priceRupees: '', playRupees: '', sort: '10' })
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setError(false)
    try {
      const res = await adminFetch(user, '/api/admin/plans')
      if (!res.ok) throw new Error('failed')
      setPlans((await res.json()).plans)
    } catch {
      setError(true)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  async function patch(planId: string, body: Record<string, unknown>) {
    if (!user) return
    setMsg(null)
    const res = await adminFetch(user, `/api/admin/plans/${planId}`, { method: 'PATCH', body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    setMsg(res.ok ? 'Updated.' : (data.error ?? 'Update failed.'))
    if (res.ok) await load()
  }

  async function create() {
    if (!user) return
    setCreating(true)
    setMsg(null)
    try {
      const months = form.duration === 'lifetime' ? null : Number(form.duration)
      const body = {
        id: form.id.trim(),
        appId: form.appId,
        tier: form.tier,
        durationMonths: months,
        lifetime: months === null,
        pricePaise: Math.round(Number(form.priceRupees) * 100),
        playStorePricePaise: form.playRupees ? Math.round(Number(form.playRupees) * 100) : null,
        sort: Number(form.sort),
      }
      const res = await adminFetch(user, '/api/admin/plans', { method: 'POST', body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      setMsg(res.ok ? `Created ${body.id}.` : (data.error ?? 'Create failed.'))
      if (res.ok) {
        setForm({ ...form, id: '', priceRupees: '', playRupees: '' })
        await load()
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      {msg ? <p role="status" className="mb-4 font-mono text-xs uppercase tracking-[0.1em] text-muted">{msg}</p> : null}

      {error ? (
        <Card className="rounded-2xl border-2 border-line-strong">
          <p role="alert" className="text-sm text-red-500">Couldn't load plans.</p>
          <div className="mt-4"><Button variant="outline" size="sm" onClick={() => void load()}>Retry</Button></div>
        </Card>
      ) : !plans ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading plans">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-16 rounded-2xl border-2 border-line-strong" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <Card className="rounded-2xl border-2 border-line-strong text-center">
          <p className="text-sm text-muted">No plans yet. Create one below.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {plans.map((p) => (
            <PlanRowCard key={p.id} plan={p} onPatch={patch} onDeactivate={() => setDeactivate(p.id)} />
          ))}
        </div>
      )}

      <Card className="mt-8 max-w-lg rounded-2xl border-2 border-line-strong">
        <h2 className="font-display text-lg font-bold text-fg">Create plan</h2>
        <p className="mt-1 text-xs text-muted">
          Prices are immutable after creation (Razorpay). To change a price, create a new plan and deactivate the old one.
        </p>
        <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
          <Input label="Plan id (slug)" placeholder="crackloop-pro-3m" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="plan-app" className="text-sm font-medium text-fg">App</label>
            <select id="plan-app" value={form.appId} onChange={(e) => setForm({ ...form, appId: e.target.value })} className="h-10 rounded-lg border border-line bg-card px-3 text-sm text-fg">
              {APPS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="plan-tier" className="text-sm font-medium text-fg">Tier</label>
            <select id="plan-tier" value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value as 'pro' | 'ai' })} className="h-10 rounded-lg border border-line bg-card px-3 text-sm text-fg">
              <option value="pro">Pro</option>
              <option value="ai">AI</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="plan-duration" className="text-sm font-medium text-fg">Duration</label>
            <select id="plan-duration" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} className="h-10 rounded-lg border border-line bg-card px-3 text-sm text-fg">
              {DURATIONS.map((d) => <option key={d.label} value={d.months === null ? 'lifetime' : String(d.months)}>{d.label}</option>)}
            </select>
          </div>
          <Input label="Price (₹)" type="number" min={1} value={form.priceRupees} onChange={(e) => setForm({ ...form, priceRupees: e.target.value })} />
          <Input label="Play Store price (₹, optional)" type="number" value={form.playRupees} onChange={(e) => setForm({ ...form, playRupees: e.target.value })} />
          <Input label="Sort" type="number" value={form.sort} onChange={(e) => setForm({ ...form, sort: e.target.value })} />
        </div>
        <div className="mt-5 border-t border-line pt-4">
          <Button size="sm" disabled={creating || !form.id || !form.priceRupees} onClick={() => void create()}>
            {creating ? 'Creating…' : 'Create plan'}
          </Button>
        </div>
      </Card>

      <TierContentEditor />

      <ConfirmModal
        open={deactivate !== null}
        title="Deactivate plan?"
        body="The plan disappears from pricing and the app API. Existing subscribers are unaffected."
        confirmLabel="Deactivate"
        destructive
        onConfirm={() => {
          if (deactivate) void patch(deactivate, { active: false })
          setDeactivate(null)
        }}
        onClose={() => setDeactivate(null)}
      />
    </div>
  )
}

function PlanRowCard({
  plan: p,
  onPatch,
  onDeactivate,
}: {
  plan: PlanRow
  onPatch: (planId: string, body: Record<string, unknown>) => Promise<void>
  onDeactivate: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [playRupees, setPlayRupees] = useState(p.playStorePricePaise !== null ? String(p.playStorePricePaise / 100) : '')
  const [sort, setSort] = useState(String(p.sort))
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await onPatch(p.id, {
        playStorePricePaise: playRupees ? Math.round(Number(playRupees) * 100) : null,
        sort: Number(sort),
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="rounded-2xl border-2 border-line-strong p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-display font-bold text-fg">
            {p.id} <Badge tone={p.active ? 'success' : 'warn'}>{p.active ? 'active' : 'inactive'}</Badge>
          </p>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.1em] text-muted">
            {p.appId} · {p.tier.toUpperCase()} · {p.lifetime ? 'Lifetime' : `${p.durationMonths}mo`} ·{' '}
            {formatINR(p.pricePaise)}
            {p.playStorePricePaise ? ` (Play ${formatINR(p.playStorePricePaise)})` : ''} · sort {p.sort}
            {p.razorpayPlanId ? '' : p.lifetime ? '' : ' · NOT SEEDED'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Close' : 'Edit'}
          </Button>
          {p.active ? (
            <Button variant="outline" size="sm" onClick={onDeactivate}>Deactivate</Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => void onPatch(p.id, { active: true })}>Activate</Button>
          )}
        </div>
      </div>
      {editing ? (
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4">
          <div className="w-44">
            <Input
              label="Play Store price (₹)"
              type="number"
              min={0}
              value={playRupees}
              onChange={(e) => setPlayRupees(e.target.value)}
            />
          </div>
          <div className="w-28">
            <Input label="Sort" type="number" value={sort} onChange={(e) => setSort(e.target.value)} />
          </div>
          <Button size="sm" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <p className="w-full text-xs text-muted">
            Web price is fixed by Razorpay — to change it, create a new plan and deactivate this one.
          </p>
        </div>
      ) : null}
    </Card>
  )
}

function TierContentEditor() {
  const { user } = useAuth()
  const [tiers, setTiers] = useState<TierContent[] | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setError(false)
    try {
      const res = await adminFetch(user, '/api/admin/tiers')
      if (!res.ok) throw new Error('failed')
      setTiers((await res.json()).tiers)
    } catch {
      setError(true)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="mt-12">
      <div className="flex items-baseline justify-between border-b-2 border-line-strong pb-3">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Tier card content</p>
        <p className="hidden font-mono text-xs uppercase tracking-[0.18em] text-muted sm:block">
          shown on /pricing
        </p>
      </div>
      <p className="mt-3 text-xs text-muted">
        Title, description, benefits, offer badge, and savings label of each pricing card. Savings %
        itself is computed from the plan prices above.
      </p>
      {error ? (
        <Card className="mt-4 rounded-2xl border-2 border-line-strong">
          <p role="alert" className="text-sm text-red-500">Couldn&rsquo;t load tier content.</p>
          <div className="mt-4"><Button variant="outline" size="sm" onClick={() => void load()}>Retry</Button></div>
        </Card>
      ) : !tiers ? (
        <div className="mt-4 space-y-3" aria-busy="true" aria-label="Loading tier content">
          {[0, 1].map((i) => <div key={i} className="skeleton h-40 rounded-2xl border-2 border-line-strong" />)}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {tiers.map((t) => <TierForm key={t.id} tier={t} onSaved={load} />)}
        </div>
      )}
    </div>
  )
}

function TierForm({ tier, onSaved }: { tier: TierContent; onSaved: () => Promise<void> }) {
  const { user } = useAuth()
  const [form, setForm] = useState({
    title: tier.title,
    blurb: tier.blurb,
    benefits: tier.benefits.join('\n'),
    offerName: tier.offerName,
    compareLabel: tier.compareLabel,
    highlight: tier.highlight,
    sort: String(tier.sort),
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function save() {
    if (!user) return
    setSaving(true)
    setMsg(null)
    try {
      const res = await adminFetch(user, '/api/admin/tiers', {
        method: 'PUT',
        body: JSON.stringify({
          appId: tier.appId,
          tier: tier.tier,
          title: form.title,
          blurb: form.blurb,
          benefits: form.benefits.split('\n').map((b) => b.trim()).filter(Boolean),
          offerName: form.offerName,
          compareLabel: form.compareLabel,
          highlight: form.highlight,
          sort: Number(form.sort),
        }),
      })
      const data = await res.json().catch(() => ({}))
      setMsg(res.ok ? 'Saved — live on /pricing.' : (data.error ?? 'Save failed.'))
      if (res.ok) await onSaved()
    } catch {
      setMsg('Save failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="rounded-2xl border-2 border-line-strong">
      <p className="flex items-center gap-2 font-display font-bold text-fg">
        {tier.appId} · {tier.tier.toUpperCase()}
        {form.highlight ? <Badge>highlighted</Badge> : null}
      </p>
      <div className="mt-4 grid gap-4">
        <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <Input label="Description (blurb)" value={form.blurb} onChange={(e) => setForm({ ...form, blurb: e.target.value })} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`benefits-${tier.id}`} className="font-mono text-xs uppercase tracking-[0.14em] text-fg">
            Benefits (one per line)
          </label>
          <textarea
            id={`benefits-${tier.id}`}
            rows={5}
            value={form.benefits}
            onChange={(e) => setForm({ ...form, benefits: e.target.value })}
            className="rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Offer badge (empty = none)" value={form.offerName} onChange={(e) => setForm({ ...form, offerName: e.target.value })} />
          <Input label="Savings label" value={form.compareLabel} onChange={(e) => setForm({ ...form, compareLabel: e.target.value })} />
          <Input label="Sort" type="number" value={form.sort} onChange={(e) => setForm({ ...form, sort: e.target.value })} />
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-fg">
            <input
              type="checkbox"
              checked={form.highlight}
              onChange={(e) => setForm({ ...form, highlight: e.target.checked })}
            />
            Highlight card
          </label>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
        <Button size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {msg ? <p role="status" className="font-mono text-xs uppercase tracking-[0.1em] text-muted">{msg}</p> : null}
      </div>
    </Card>
  )
}
