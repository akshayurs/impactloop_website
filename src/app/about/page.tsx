import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About',
  description: 'Impact Loop is an indie studio building focused learning apps that turn effort into small, repeatable loops.',
  alternates: { canonical: '/about' },
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <span className="kicker">About</span>
      <h1 className="mt-4 font-display text-4xl font-bold text-fg sm:text-5xl">
        Small loops, <span className="loop-underline">real progress.</span>
      </h1>

      <p className="mt-8 text-lg text-muted">
        Impact Loop is an indie app studio, run by one person in India. We build focused mobile
        apps for learning and self-improvement — the kind you can actually keep up with, because
        they ask for a few honest minutes a day instead of a grand plan you abandon by Friday.
      </p>

      <h2 className="mt-12 border-b border-line pb-2 font-display text-xl font-semibold text-fg">The idea</h2>
      <p className="mt-3 text-muted">
        Most progress isn’t one big push — it’s a loop you repeat. Learn a little, practice it,
        review what slipped, come back tomorrow. Our apps are built around that loop:
        short sessions, smart review of your weak spots, and just enough streaks and feedback to
        make the next session easy to start.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">What we make</h2>
      <p className="mt-3 text-muted">
        The first app is <strong className="text-fg">CrackLoop</strong> — tech-interview prep as
        short daily loops. It’s free on Google Play; a paid upgrade unlocks the full experience,
        and buying it <Link href="/pricing" className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">on the web</Link> costs
        less than through the app store. More apps are on the way.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">How we work</h2>
      <p className="mt-3 text-muted">
        Independent and lean, which means we ship carefully and answer email ourselves. We keep
        data collection to the minimum it takes to run your account and payments (see our{' '}
        <Link href="/privacy" className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">Privacy Policy</Link>),
        and we run a{' '}
        <Link href="/partners" className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">partner program</Link>{' '}
        so creators who share our apps earn a fair cut.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">Say hello</h2>
      <p className="mt-3 text-muted">
        Questions, feedback, or ideas? Reach us any time at{' '}
        <a className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent" href="mailto:impactloopapps@gmail.com">
          impactloopapps@gmail.com
        </a>{' '}
        or via our{' '}
        <Link href="/contact" className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">contact page</Link>.
      </p>
    </div>
  )
}
