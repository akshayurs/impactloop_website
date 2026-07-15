'use client'
import { useState } from 'react'
import { CheckoutButton } from './checkout-button'
import type { Plan } from '@/config/plans'
import { formatINR } from '@/lib/format'

export function durationLabel(plan: Plan): string {
  if (plan.lifetime) return 'Lifetime'
  return plan.durationMonths === 1 ? '1 month' : `${plan.durationMonths} months`
}

function savingsPct(plan: Plan): number | null {
  if (!plan.playStorePricePaise) return null
  return Math.round(((plan.playStorePricePaise - plan.pricePaise) / plan.playStorePricePaise) * 100)
}

function defaultPlanId(plans: Plan[]): string {
  const yearly = plans.find((p) => p.durationMonths === 12)
  return (yearly ?? plans[0]).id
}

export function PlanTierCard({
  title,
  blurb,
  benefits,
  plans,
  offerName = '',
  compareLabel = 'vs Google Play',
  highlight = false,
}: {
  title: string
  blurb: string
  benefits: string[]
  plans: Plan[]
  offerName?: string
  compareLabel?: string
  highlight?: boolean
}) {
  const [selectedId, setSelectedId] = useState(() => defaultPlanId(plans))
  const selected = plans.find((p) => p.id === selectedId) ?? plans[0]
  const savings = savingsPct(selected)
  const perMonth =
    !selected.lifetime && selected.durationMonths && selected.durationMonths > 1
      ? Math.round(selected.pricePaise / selected.durationMonths / 100) * 100
      : null

  return (
    <article
      className={`relative flex flex-col rounded-2xl border-2 bg-card p-8 ${
        highlight ? 'border-accent shadow-(--shadow-glow)' : 'border-line-strong'
      }`}
    >
      {offerName ? (
        <span className="absolute -top-3.5 left-8 rounded-full bg-accent px-3 py-1 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-accent-fg">
          {offerName}
        </span>
      ) : null}

      <h3 className="font-display text-2xl font-bold uppercase text-fg">{title}</h3>
      <p className="mt-1 text-sm text-muted">{blurb}</p>

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label={`${title} duration`}>
        {plans.map((p) => {
          const active = p.id === selected.id
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSelectedId(p.id)}
              className={`rounded-full border-2 px-4 py-1.5 font-mono text-xs uppercase tracking-[0.12em] transition-colors ${
                active
                  ? 'border-accent bg-accent text-accent-fg'
                  : 'border-line text-muted hover:border-line-strong hover:text-fg'
              }`}
            >
              {durationLabel(p)}
            </button>
          )
        })}
      </div>

      <p className="mt-6 flex items-baseline gap-3">
        <span className="font-display text-5xl font-bold text-fg">{formatINR(selected.pricePaise)}</span>
        {selected.playStorePricePaise ? (
          <s
            className="text-sm text-muted"
            aria-label={`Play Store price ${formatINR(selected.playStorePricePaise)}`}
          >
            {formatINR(selected.playStorePricePaise)}
          </s>
        ) : null}
      </p>
      <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-muted">
        {selected.lifetime
          ? 'One-time payment · yours forever'
          : perMonth
            ? `≈ ${formatINR(perMonth)}/month · billed once`
            : 'Billed monthly'}
        {savings ? <span className="text-accent"> · save {savings}% {compareLabel}</span> : null}
      </p>

      <ul className="mt-6 space-y-2 border-t border-line pt-6">
        {benefits.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm text-muted">
            <span aria-hidden className="mt-0.5 text-accent">↳</span>
            {b}
          </li>
        ))}
      </ul>

      <div className="mt-8 flex-1" />
      <CheckoutButton plan={selected} />
    </article>
  )
}
