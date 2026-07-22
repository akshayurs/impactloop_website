import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers about CrackLoop, accounts, billing, and the partner program.',
}

const SECTIONS: { heading: string; items: { q: string; a: string }[] }[] = [
  {
    heading: 'Apps & accounts',
    items: [
      {
        q: 'What is CrackLoop?',
        a: 'CrackLoop is our exam-prep app: short daily practice loops, smart review of weak topics, streaks, and progress analytics. It is free to download on Google Play.',
      },
      {
        q: 'How do I sign in?',
        a: 'With your Google account — one click, no passwords. The same account works in the app and on this site.',
      },
      {
        q: 'Do subscriptions work across devices?',
        a: 'Yes. Your plan is tied to your Google account, so signing in on a new device brings your subscription with you.',
      },
    ],
  },
  {
    heading: 'Billing',
    items: [
      {
        q: 'Why is the web price lower than Google Play?',
        a: 'Purchases made here skip app-store fees, so we pass the difference on to you. It is the same plan and the same account either way.',
      },
      {
        q: 'What payment methods can I use?',
        a: 'Payments are processed securely by Razorpay in INR — UPI, cards, net banking, and wallets. International payments are coming soon.',
      },
      {
        q: 'How do I cancel?',
        a: 'From your account page, one click. Your plan stays active until the end of the paid period and simply does not renew.',
      },
      {
        q: 'What is a lifetime plan?',
        a: 'Pay once, keep the plan forever — no renewals, no recurring charges.',
      },
      {
        q: 'How do promo codes work?',
        a: 'Enter a partner promo code at checkout. On lifetime plans it reduces the price; on subscriptions it adds free days to your plan.',
      },
    ],
  },
  {
    heading: 'Partner program',
    items: [
      {
        q: 'How do I become a partner?',
        a: 'Sign in, open your account page, and apply with links to your social profiles. Applications are reviewed manually — once approved you pick a promo code and start sharing.',
      },
      {
        q: 'How do I earn?',
        a: 'You earn a commission whenever someone subscribes or buys using your promo code or referral link. Earnings and payouts are tracked in your partner portal.',
      },
      {
        q: 'How are payouts made?',
        a: 'Payouts are processed manually against your confirmed balance. Your portal shows balance, total earned, and payout history.',
      },
    ],
  },
]

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: SECTIONS.flatMap((s) => s.items).map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
}

export default function FaqPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <div className="hero-spot">
        <div className="mx-auto max-w-3xl px-4 pt-16 text-center sm:px-6 sm:pt-24">
          <p className="kicker justify-center">FAQ</p>
          <h1 className="mt-6 font-display text-4xl font-bold text-fg sm:text-5xl">
            Questions, <span className="loop-underline">answered.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-muted">
            Everything about the apps, billing, and the partner program. Still stuck? Email{' '}
            <a href="mailto:impactloopapps@gmail.com" className="text-fg underline hover:no-underline">
              impactloopapps@gmail.com
            </a>
            .
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-8 sm:px-6">
        {SECTIONS.map((s) => (
          <section key={s.heading} className="mt-12" aria-labelledby={`faq-${s.heading}`}>
            <h2 id={`faq-${s.heading}`} className="kicker border-b-2 border-line-strong pb-3">
              {s.heading}
            </h2>
            <div className="mt-5 space-y-3">
              {s.items.map((f) => (
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
        ))}
      </div>
    </>
  )
}
