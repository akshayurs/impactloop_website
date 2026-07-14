import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Plan } from '@/config/plans'
import { formatINR } from '@/lib/format'

export function durationLabel(plan: Plan): string {
  if (plan.lifetime) return 'Lifetime'
  return plan.durationMonths === 1 ? '1 month' : `${plan.durationMonths} months`
}

export function PlanCard({ plan }: { plan: Plan }) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold uppercase text-fg">{plan.tier}</h3>
        <Badge>{durationLabel(plan)}</Badge>
      </div>
      <p className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-fg">{formatINR(plan.pricePaise)}</span>
        {plan.playStorePricePaise ? (
          <s className="text-sm text-muted" aria-label={`Play Store price ${formatINR(plan.playStorePricePaise)}`}>
            {formatINR(plan.playStorePricePaise)}
          </s>
        ) : null}
      </p>
      {plan.playStorePricePaise ? (
        <p className="mt-1 text-xs text-muted">Cheaper than Google Play — no store fees.</p>
      ) : null}
      <div className="mt-6">
        <Button href="/account" className="w-full">
          {plan.lifetime ? 'Buy once' : 'Subscribe'}
        </Button>
      </div>
    </Card>
  )
}
