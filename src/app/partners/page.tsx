import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Partner program',
  description: 'Share Impact Loop apps with your audience and earn commission on every referral.',
}

const STEPS = [
  { n: '01', title: 'Join once', body: 'Sign in with Google and join the program from your account with links to your social profiles.' },
  { n: '02', title: 'Enroll per app', body: 'Pick the apps you want to promote — enroll in one or many. Each enrollment is reviewed personally.' },
  { n: '03', title: 'Get your codes', body: 'Once approved for an app, create a promo code for it. Its link opens that app’s page for your audience.' },
  { n: '04', title: 'Earn on every sale', body: 'Commission lands whenever someone buys with your code. Track every app’s referrals in one portal.' },
]

const PERKS = [
  {
    title: 'Your audience saves',
    body: 'Your code gives followers a discount on lifetime plans or free days on subscriptions — real value, not a gimmick.',
  },
  {
    title: 'Transparent earnings',
    body: 'The partner portal shows every referral, your balance, total earned, and payout history — nothing hidden.',
  },
  {
    title: 'Commission on verified payments',
    body: 'Commissions are credited from payment-verified events, so your balance reflects real, completed purchases.',
  },
  {
    title: 'Custom rates',
    body: 'Commission rates are set per partner. Bigger reach and better fit can mean better rates — talk to us.',
  },
]

export default function PartnersPage() {
  return (
    <>
      <section className="hero-spot relative overflow-hidden">
        <div aria-hidden className="orbit left-1/2 top-[-32rem] h-[52rem] w-[52rem] -translate-x-1/2" />
        <div className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6 sm:py-28">
          <p className="kicker justify-center">Partner program</p>
          <h1 className="mx-auto mt-6 max-w-3xl font-display text-5xl font-bold tracking-tight text-fg sm:text-6xl">
            Share apps you believe in. <span className="loop-underline">Get paid.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted">
            Recommend the Impact Loop apps you love with your own promo code — one per app. Your
            audience saves on every plan, you earn commission on every purchase.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button href="/account" size="lg">Apply now</Button>
            <Button href="/influencer" size="lg" variant="outline">Open partner portal</Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" aria-labelledby="how-partners">
        <div className="flex items-baseline justify-between border-b-2 border-line-strong pb-4">
          <p className="kicker">01 — How it works</p>
        </div>
        <h2 id="how-partners" className="mt-8 font-display text-4xl font-bold text-fg">
          Four steps, no fine print.
        </h2>
        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border-2 border-line-strong bg-line-strong sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="reveal bg-card p-6">
              <span aria-hidden className="font-mono text-4xl font-bold text-accent">{s.n}</span>
              <h3 className="mt-3 font-display text-lg font-semibold text-fg">{s.title}</h3>
              <p className="mt-2 text-sm text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y-2 border-line-strong bg-bg-raised" aria-labelledby="perks-heading">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="flex items-baseline justify-between border-b border-line pb-4">
            <p className="kicker">02 — Why us</p>
          </div>
          <h2 id="perks-heading" className="mt-8 font-display text-4xl font-bold text-fg">
            Built to be worth promoting.
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {PERKS.map((p) => (
              <Card key={p.title} interactive className="border-2 border-line-strong">
                <h3 className="font-display text-lg font-semibold text-fg">{p.title}</h3>
                <p className="mt-2 text-sm text-muted">{p.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="dot-grid">
        <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
          <h2 className="font-display text-3xl font-semibold text-fg sm:text-4xl">
            Ready to start <span className="loop-underline">earning?</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted">
            Applying takes a minute — sign in, drop your social links, and you are in the queue.
          </p>
          <div className="mt-8">
            <Button href="/account" size="lg">Apply from your account</Button>
          </div>
        </div>
      </section>
    </>
  )
}
