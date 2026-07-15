import type { Metadata } from 'next'
import { PlanTierCard } from '@/components/plan-tier-card'
import { APPS } from '@/config/apps'
import { getPlans, type Plan } from '@/config/plans'
import { getTiersFromDb } from '@/lib/server/tiers-store'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Subscribe on the web and pay less than on Google Play. Cancel anytime.',
}
export const revalidate = 300

const FAQS = [
  {
    q: 'Why is the web price lower than Google Play?',
    a: 'Purchases made here skip app-store fees, so we pass the difference on to you. It is the same plan and the same account either way.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Subscriptions can be cancelled from your account page in one click — you keep access until the end of the paid period.',
  },
  {
    q: 'How do promo codes work?',
    a: 'Enter a partner promo code at checkout. On lifetime plans it reduces the price; on subscriptions it adds free days to your plan.',
  },
  {
    q: 'Which payment methods are supported?',
    a: 'Payments are processed securely by Razorpay in INR — UPI, cards, net banking, and wallets. International payments are coming soon.',
  },
  {
    q: 'Where do I manage my subscription?',
    a: 'Sign in and open your account page to see your plan, payment history, and cancellation options.',
  },
]

function groupByTier(plans: Plan[]): Map<string, Plan[]> {
  const groups = new Map<string, Plan[]>()
  for (const p of plans) {
    const list = groups.get(p.tier) ?? []
    list.push(p)
    groups.set(p.tier, list)
  }
  return groups
}

export default async function PricingPage() {
  const sections = await Promise.all(
    APPS.filter((a) => a.status === 'live').map(async (app) => ({
      app,
      plans: await getPlans(app.id),
      tiers: await getTiersFromDb(app.id),
    })),
  )

  return (
    <>
      <div className="hero-spot relative overflow-hidden">
        <div aria-hidden className="orbit left-1/2 top-[-32rem] h-[50rem] w-[50rem] -translate-x-1/2" />
        <div className="mx-auto max-w-6xl px-4 pb-4 pt-16 text-center sm:px-6 sm:pt-24">
          <p className="kicker justify-center">Pricing</p>
          <h1 className="mt-6 font-display text-4xl font-bold text-fg sm:text-6xl">
            Same app, <span className="loop-underline">smaller bill.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            Subscribe on the web and pay less than on Google Play. One account, works everywhere.
            Cancel anytime from your account.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        {sections.map(({ app, plans, tiers }) => {
          const plansByTier = groupByTier(plans)
          return (
            <section key={app.id} className="mt-12" aria-labelledby={`pricing-${app.id}`}>
              <div className="flex items-baseline justify-between border-b-2 border-line-strong pb-4">
                <h2 id={`pricing-${app.id}`} className="kicker">
                  {app.name}
                </h2>
                <p className="hidden font-mono text-xs uppercase tracking-[0.18em] text-muted sm:block">
                  pick a tier · pick a duration
                </p>
              </div>
              <div className="mx-auto mt-10 grid max-w-4xl gap-8 md:grid-cols-2">
                {tiers
                  .filter((t) => (plansByTier.get(t.tier) ?? []).length > 0)
                  .map((t) => (
                    <PlanTierCard
                      key={t.id}
                      title={t.title}
                      blurb={t.blurb}
                      benefits={t.benefits}
                      offerName={t.offerName}
                      compareLabel={t.compareLabel}
                      plans={plansByTier.get(t.tier)!}
                      highlight={t.highlight}
                    />
                  ))}
              </div>
            </section>
          )
        })}

        <div className="mt-14 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 rounded-2xl border-2 border-line-strong bg-bg-raised px-6 py-5 font-mono text-xs uppercase tracking-[0.14em] text-muted">
          <span>🔒 Secure payments via Razorpay</span>
          <span>↺ Cancel anytime</span>
          <span>₹ INR today · international coming soon</span>
        </div>

        <section className="mx-auto mt-24 max-w-3xl" aria-labelledby="pricing-faq">
          <p className="kicker justify-center text-center">Questions</p>
          <h2 id="pricing-faq" className="mt-4 text-center font-display text-3xl font-bold text-fg">
            Before you subscribe.
          </h2>
          <div className="mt-8 space-y-3">
            {FAQS.map((f) => (
              <details key={f.q} className="group rounded-2xl border-2 border-line bg-card px-5 py-4 open:border-line-strong">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-fg [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden className="font-mono text-muted transition-transform group-open:rotate-45">＋</span>
                </summary>
                <p className="mt-3 text-sm text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
