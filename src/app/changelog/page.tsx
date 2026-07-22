import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'What’s new',
  description: 'Recently shipped features and what’s coming next at Impact Loop.',
  alternates: { canonical: '/changelog' },
}

const SHIPPED = [
  'Buy on the web and pay less than on Google Play — subscriptions and lifetime unlocks.',
  'Partner program: promo codes, referral links, commissions, and payouts.',
  'One-click Google sign-in that works across the app and the site.',
  'Full light/dark mode and a faster, cleaner pricing page.',
]

const NEXT = [
  'Automatic refunds handling for subscriptions.',
  'International payments and multi-currency pricing.',
  'Downloadable payment receipts.',
  'More apps beyond CrackLoop.',
]

function List({ title, kicker, items }: { title: string; kicker: string; items: string[] }) {
  return (
    <section className="mt-12">
      <h2 className="kicker border-b-2 border-line-strong pb-3">{kicker}</h2>
      <h3 className="mt-5 font-display text-2xl font-bold text-fg">{title}</h3>
      <ul className="mt-4 space-y-2 text-muted">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-2">
            <span aria-hidden className="mt-1 text-accent">↳</span>
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <span className="kicker">What’s new</span>
      <h1 className="mt-4 font-display text-4xl font-bold text-fg sm:text-5xl">
        Shipping, <span className="loop-underline">in loops.</span>
      </h1>
      <p className="mt-6 text-muted">
        We build in the open-ish. Here’s what recently landed and what we’re working on next.
      </p>
      <List kicker="Recently shipped" title="Now live" items={SHIPPED} />
      <List kicker="On the roadmap" title="Coming next" items={NEXT} />
    </div>
  )
}
