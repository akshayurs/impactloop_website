'use client'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmModal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { formatINR } from '@/lib/format'
import type { TierContent } from '@/config/tiers'
import { useAuth } from '@/lib/auth-context'
import { adminFetch } from './admin-fetch'

type PlanRow = {
  id: string; appId: string; tier: 'pro' | 'ai'; durationMonths: number | null; lifetime: boolean
  pricePaise: number; playStorePricePaise: number | null; active: boolean; sort: number; razorpayPlanId: string | null
}

const DURATIONS = [
  { label: '1 month', value: '1' }, { label: '3 months', value: '3' },
  { label: '6 months', value: '6' }, { label: '12 months', value: '12' },
  { label: 'Lifetime', value: 'lifetime' },
] as const

/* One card per tier: marketing content (title/blurb/benefits/badge) + its plans
   (durations & prices) + add-duration form. Everything the /pricing card shows. */
export function AdminPlans() {
  const { user } = useAuth()
  const [plans, setPlans] = useState<PlanRow[] | null>(null)
  const [tiers, setTiers] = useState<TierContent[] | null>(null)
  const [error, setError] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [deactivate, setDeactivate] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setError(false)
    try {
      const [plansRes, tiersRes] = await Promise.all([
        adminFetch(user, '/api/admin/plans'),
        adminFetch(user, '/api/admin/tiers'),
      ])
      if (!plansRes.ok || !tiersRes.ok) throw new Error('failed')
      setPlans((await plansRes.json()).plans)
      setTiers((await tiersRes.json()).tiers)
    } catch {
      setError(true)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  async function patchPlan(planId: string, body: Record<string, unknown>) {
    if (!user) return
    setMsg(null)
    const res = await adminFetch(user, `/api/admin/plans/${planId}`, { method: 'PATCH', body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    setMsg(res.ok ? 'Updated.' : (data.error ?? 'Update failed.'))
    if (res.ok) await load()
  }

  if (error) {
    return (
      <Card className="rounded-2xl border-2 border-line-strong">
        <p role="alert" className="text-sm text-red-500">Couldn&rsquo;t load pricing.</p>
        <div className="mt-4"><Button variant="outline" size="sm" onClick={() => void load()}>Retry</Button></div>
      </Card>
    )
  }
  if (!plans || !tiers) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading pricing">
        {[0, 1].map((i) => <div key={i} className="skeleton h-72 rounded-2xl border-2 border-line-strong" />)}
      </div>
    )
  }

  const grouped = tiers.map((t) => ({
    tier: t,
    plans: plans.filter((p) => p.appId === t.appId && p.tier === t.tier).sort((a, b) => a.sort - b.sort),
  }))
  const covered = new Set(grouped.flatMap((g) => g.plans.map((p) => p.id)))
  const orphans = plans.filter((p) => !covered.has(p.id))

  return (
    <div>
      {msg ? <p role="status" className="mb-4 font-mono text-xs uppercase tracking-[0.1em] text-muted">{msg}</p> : null}

      <div className="grid gap-6">
        {grouped.map(({ tier, plans: tierPlans }) => (
          <TierGroupCard
            key={tier.id}
            tier={tier}
            plans={tierPlans}
            onPatchPlan={patchPlan}
            onDeactivate={setDeactivate}
            onReload={load}
            setMsg={setMsg}
          />
        ))}
        {orphans.length > 0 ? (
          <Card className="rounded-2xl border-2 border-dashed border-line">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
              Plans without a tier card (save tier content to adopt them)
            </p>
            <ul className="mt-3 space-y-1 font-mono text-xs text-muted">
              {orphans.map((p) => <li key={p.id}>{p.id} · {formatINR(p.pricePaise)}</li>)}
            </ul>
          </Card>
        ) : null}
      </div>

      <ConfirmModal
        open={deactivate !== null}
        title="Deactivate plan?"
        body="The plan disappears from pricing and the app API. Existing subscribers are unaffected."
        confirmLabel="Deactivate"
        destructive
        onConfirm={() => {
          if (deactivate) void patchPlan(deactivate, { active: false })
          setDeactivate(null)
        }}
        onClose={() => setDeactivate(null)}
      />
    </div>
  )
}

function TierGroupCard({
  tier,
  plans,
  onPatchPlan,
  onDeactivate,
  onReload,
  setMsg,
}: {
  tier: TierContent
  plans: PlanRow[]
  onPatchPlan: (planId: string, body: Record<string, unknown>) => Promise<void>
  onDeactivate: (planId: string) => void
  onReload: () => Promise<void>
  setMsg: (m: string | null) => void
}) {
  return (
    <Card className="rounded-2xl border-2 border-line-strong p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-line-strong px-6 py-4">
        <p className="flex items-center gap-2 font-display text-lg font-bold text-fg">
          {tier.appId} · {tier.title}
          {tier.offerName ? <Badge>{tier.offerName}</Badge> : null}
          {tier.highlight ? <Badge tone="success">highlighted</Badge> : null}
        </p>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">/pricing card</p>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1fr_1.2fr]">
        <div className="border-b border-line p-6 lg:border-b-0 lg:border-r">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Card content</p>
          <TierContentForm tier={tier} onSaved={onReload} />
        </div>

        <div className="p-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Durations &amp; prices</p>
          <div className="mt-4 space-y-3">
            {plans.length === 0 ? (
              <p className="text-sm text-muted">No plans yet — add a duration below.</p>
            ) : (
              plans.map((p) => (
                <PlanRowInline key={p.id} plan={p} onPatch={onPatchPlan} onDeactivate={() => onDeactivate(p.id)} />
              ))
            )}
          </div>
          <AddDurationForm tier={tier} existing={plans} onCreated={onReload} setMsg={setMsg} />
        </div>
      </div>
    </Card>
  )
}

function TierContentForm({ tier, onSaved }: { tier: TierContent; onSaved: () => Promise<void> }) {
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
    <div className="mt-4 grid gap-4">
      <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <Input label="Description" value={form.blurb} onChange={(e) => setForm({ ...form, blurb: e.target.value })} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`benefits-${tier.id}`} className="font-mono text-xs uppercase tracking-[0.14em] text-fg">
          Benefits (one per line)
        </label>
        <textarea
          id={`benefits-${tier.id}`}
          rows={4}
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
      <div className="flex items-center gap-3 border-t border-line pt-4">
        <Button size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save content'}
        </Button>
        {msg ? <p role="status" className="font-mono text-xs uppercase tracking-[0.1em] text-muted">{msg}</p> : null}
      </div>
    </div>
  )
}

function PlanRowInline({
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
    <div className="rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.1em] text-fg">
          {p.lifetime ? 'Lifetime' : `${p.durationMonths} mo`} · <strong>{formatINR(p.pricePaise)}</strong>
          {p.playStorePricePaise ? <span className="text-muted"> (Play {formatINR(p.playStorePricePaise)})</span> : null}
          <Badge tone={p.active ? 'success' : 'warn'}>{p.active ? 'active' : 'inactive'}</Badge>
          {p.razorpayPlanId || p.lifetime ? null : <span className="text-red-500"> NOT SEEDED</span>}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Close' : 'Edit'}
          </Button>
          {p.active ? (
            <Button variant="ghost" size="sm" onClick={onDeactivate}>Deactivate</Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => void onPatch(p.id, { active: true })}>Activate</Button>
          )}
        </div>
      </div>
      {editing ? (
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-line pt-3">
          <div className="w-40">
            <Input label="Play Store price (₹)" type="number" min={0} value={playRupees} onChange={(e) => setPlayRupees(e.target.value)} />
          </div>
          <div className="w-24">
            <Input label="Sort" type="number" value={sort} onChange={(e) => setSort(e.target.value)} />
          </div>
          <Button size="sm" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <p className="w-full text-xs text-muted">
            Web price is fixed by Razorpay — to change it, add a new duration and deactivate this one.
          </p>
        </div>
      ) : null}
    </div>
  )
}

function AddDurationForm({
  tier,
  existing,
  onCreated,
  setMsg,
}: {
  tier: TierContent
  existing: PlanRow[]
  onCreated: () => Promise<void>
  setMsg: (m: string | null) => void
}) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ duration: '1', priceRupees: '', playRupees: '' })
  const [creating, setCreating] = useState(false)

  async function create() {
    if (!user) return
    setCreating(true)
    setMsg(null)
    try {
      const months = form.duration === 'lifetime' ? null : Number(form.duration)
      const suffix = months === null ? 'life' : `${months}m`
      const body = {
        id: `${tier.appId}-${tier.tier}-${suffix}`,
        appId: tier.appId,
        tier: tier.tier,
        durationMonths: months,
        lifetime: months === null,
        pricePaise: Math.round(Number(form.priceRupees) * 100),
        playStorePricePaise: form.playRupees ? Math.round(Number(form.playRupees) * 100) : null,
        sort: (existing[existing.length - 1]?.sort ?? 0) + 1,
      }
      const res = await adminFetch(user, '/api/admin/plans', { method: 'POST', body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      setMsg(res.ok ? `Created ${body.id}.` : (data.error ?? 'Create failed.'))
      if (res.ok) {
        setForm({ duration: '1', priceRupees: '', playRupees: '' })
        setOpen(false)
        await onCreated()
      }
    } finally {
      setCreating(false)
    }
  }

  if (!open) {
    return (
      <div className="mt-4">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>+ Add duration</Button>
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-xl border border-dashed border-line-strong p-4">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
        New duration for {tier.appId} · {tier.title}
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="flex w-32 flex-col gap-1.5">
          <label htmlFor={`dur-${tier.id}`} className="font-mono text-xs uppercase tracking-[0.14em] text-fg">Duration</label>
          <select
            id={`dur-${tier.id}`}
            value={form.duration}
            onChange={(e) => setForm({ ...form, duration: e.target.value })}
            className="h-10 rounded-lg border border-line bg-card px-3 text-sm text-fg"
          >
            {DURATIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div className="w-32">
          <Input label="Price (₹)" type="number" min={1} value={form.priceRupees} onChange={(e) => setForm({ ...form, priceRupees: e.target.value })} />
        </div>
        <div className="w-40">
          <Input label="Play price (₹, opt.)" type="number" value={form.playRupees} onChange={(e) => setForm({ ...form, playRupees: e.target.value })} />
        </div>
        <Button size="sm" disabled={creating || !form.priceRupees} onClick={() => void create()}>
          {creating ? 'Creating…' : 'Create'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      <p className="mt-2 text-xs text-muted">
        Price is immutable after creation (Razorpay). Plan id will be {tier.appId}-{tier.tier}-…
      </p>
    </div>
  )
}
