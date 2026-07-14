import type { Metadata } from 'next'
import { PlanCard } from '@/components/plan-card'
import { APPS } from '@/config/apps'
import { getPlans } from '@/config/plans'

export const metadata: Metadata = { title: 'Pricing' }
export const revalidate = 300

export default async function PricingPage() {
  const sections = await Promise.all(
    APPS.filter((a) => a.status === 'live').map(async (app) => ({
      app,
      plans: await getPlans(app.id),
    })),
  )

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-4xl font-bold text-fg">Pricing</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Subscribe on the web and pay less than on Google Play. Cancel anytime from your account.
      </p>
      {sections.map(({ app, plans }) => (
        <section key={app.id} className="mt-12" aria-labelledby={`pricing-${app.id}`}>
          <h2 id={`pricing-${app.id}`} className="font-display text-2xl font-semibold text-fg">
            {app.name}
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((p) => (
              <PlanCard key={p.id} plan={p} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
