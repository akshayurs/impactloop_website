import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { APPS } from '@/config/apps'

const liveApps = APPS.filter((a) => a.status === 'live')
const flagship = liveApps[0] ?? APPS[0]
const marqueeTopics = Array.from(new Set(liveApps.flatMap((a) => a.topics)))

const STEPS = [
  {
    n: '01',
    title: 'Pick a loop',
    body: 'Choose the app for the skill you’re building. Each one runs on the same daily-habit engine.',
  },
  {
    n: '02',
    title: 'Run it daily',
    body: 'A few focused minutes — swipe, practice, review yesterday’s misses. Short enough to never skip.',
  },
  {
    n: '03',
    title: 'Close the loop',
    body: 'Streaks, spaced repetition and rewards lock the habit in long after day one.',
  },
]

/* Slots for future apps — the studio ships more loops over time. */
const FUTURE_SLOTS = [
  { n: '02', hint: 'In the works' },
  { n: '03', hint: 'On the roadmap' },
]

export default function HomePage() {
  return (
    <>
      {/* ——— Hero ——— */}
      <section className="hero-spot relative overflow-hidden">
        <div aria-hidden className="orbit left-1/2 top-[-30rem] h-[50rem] w-[50rem] -translate-x-1/2" />
        <div aria-hidden className="orbit orbit-reverse left-1/2 top-[-34rem] h-[58rem] w-[58rem] -translate-x-1/2" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="kicker fade-up">Indie app studio — India</p>
            <h1 className="fade-up fade-up-1 mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight text-fg sm:text-7xl">
              Apps that build <span className="loop-underline">habits</span> that stick.
            </h1>
            <p className="fade-up fade-up-2 mt-6 max-w-xl text-lg text-muted">
              One focused loop a day beats a weekend of cramming. Impact Loop is a studio building
              learning apps around that single idea — starting with{' '}
              <strong className="text-fg">CrackLoop</strong> for tech interviews, with more loops on
              the way.
            </p>
            <div className="fade-up fade-up-3 mt-10 flex flex-wrap gap-3">
              <Button href="/apps" size="lg">Explore the apps</Button>
              <Button href="/pricing" size="lg" variant="outline">See pricing</Button>
            </div>
            <p className="fade-up fade-up-3 mt-6 font-mono text-xs uppercase tracking-[0.18em] text-muted">
              Live on Google Play · Web plans cost less
            </p>
          </div>
          <div className="fade-up fade-up-2 relative mx-auto w-64 sm:w-72">
            <div aria-hidden className="loop-ring absolute -left-10 -top-8 h-24 w-24 opacity-60" />
            <Image
              src={flagship.screenshots[0]}
              alt={`${flagship.name} app`}
              width={450}
              height={780}
              priority
              className="card-lift rotate-2 rounded-2xl border-2 border-line-strong"
            />
          </div>
        </div>
      </section>

      {/* ——— Topic marquee ——— */}
      <section aria-label="What we cover" className="border-y-2 border-line-strong bg-bg-raised py-4">
        <div className="marquee">
          <div className="marquee-track">
            {[0, 1].map((dup) => (
              <span key={dup} aria-hidden={dup === 1} className="flex gap-12">
                {marqueeTopics.map((t) => (
                  <span key={t} className="flex items-center gap-3 whitespace-nowrap font-mono text-sm uppercase tracking-[0.18em] text-muted">
                    <span aria-hidden className="loop-ring inline-block h-3 w-3" />
                    {t}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ——— 01 · The apps ——— */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6" aria-labelledby="apps-heading">
        <div className="flex items-baseline justify-between border-b-2 border-line-strong pb-4">
          <p className="kicker">01 — The apps</p>
          <p className="hidden font-mono text-xs uppercase tracking-[0.18em] text-muted sm:block">
            one engine · many loops
          </p>
        </div>
        <h2 id="apps-heading" className="mt-8 max-w-2xl font-display text-4xl font-bold text-fg">
          One studio. Focused loops.
        </h2>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <Link href={`/apps/${flagship.id}`} className="group lg:col-span-2">
            <article className="card-lift flex h-full flex-col justify-between rounded-2xl border-2 border-line-strong bg-card p-8">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-display text-3xl font-bold text-fg">{flagship.name}</h3>
                  <Badge tone="success">Live on Play Store</Badge>
                </div>
                <p className="mt-1 font-mono text-xs uppercase tracking-[0.18em] text-accent">
                  {flagship.tagline}
                </p>
                <p className="mt-4 max-w-lg text-muted">{flagship.description}</p>
                <ul className="mt-6 grid gap-2 sm:grid-cols-2">
                  {flagship.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted">
                      <span aria-hidden className="mt-1 text-accent">↳</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-8 font-mono text-xs uppercase tracking-[0.18em] text-accent">
                Open app page{' '}
                <span aria-hidden className="inline-block transition-transform group-hover:translate-x-1">→</span>
              </p>
            </article>
          </Link>

          <div className="flex flex-col gap-6">
            {FUTURE_SLOTS.map((slot) => (
              <article
                key={slot.n}
                className="flex flex-1 flex-col justify-between rounded-2xl border-2 border-dashed border-line p-6"
              >
                <p className="font-mono text-4xl font-bold text-fg/10">{slot.n}</p>
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">{slot.hint}</p>
                  <p className="mt-2 text-sm text-muted">
                    The next loop is being built. Same habit engine, new subject.
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <Button href="/apps" variant="outline" size="sm">See all apps →</Button>
        </div>
      </section>

      {/* ——— 02 · The method ——— */}
      <section className="border-y-2 border-line-strong bg-bg-raised" aria-labelledby="how-heading">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="flex items-baseline justify-between border-b border-line pb-4">
            <p className="kicker">02 — The method</p>
          </div>
          <h2 id="how-heading" className="mt-8 font-display text-4xl font-bold text-fg">
            One loop a day.
          </h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border-2 border-line-strong bg-line-strong md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="reveal bg-card p-8">
                <span aria-hidden className="font-mono text-5xl font-bold text-accent">{s.n}</span>
                <h3 className="mt-4 font-display text-xl font-semibold text-fg">{s.title}</h3>
                <p className="mt-2 text-sm text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ——— 03 · Screens ——— */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6" aria-labelledby="screens-heading">
        <div className="flex items-baseline justify-between border-b-2 border-line-strong pb-4">
          <p className="kicker">03 — Inside {flagship.name}</p>
        </div>
        <h2 id="screens-heading" className="mt-8 font-display text-4xl font-bold text-fg">
          Built to open daily.
        </h2>
        <div className="-mx-4 mt-10 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
          <div className="flex w-max gap-6">
            {flagship.screenshots.slice(0, 5).map((src, i) => (
              <Image
                key={src}
                src={src}
                alt={`${flagship.name} screen ${i + 1}`}
                width={280}
                height={470}
                className={`card-lift w-56 rounded-2xl border-2 border-line-strong ${i % 2 ? 'rotate-1' : '-rotate-1'}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ——— 04 · Web pricing ——— */}
      <section className="dot-grid border-t-2 border-line-strong">
        <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
          <p className="kicker justify-center">04 — Fair pricing</p>
          <h2 className="mt-6 font-display text-4xl font-bold text-fg sm:text-5xl">
            Subscribe on the web, <span className="loop-underline">pay less.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            Web subscriptions skip app-store fees, so plans here cost less than the same plans on
            Google Play. One account, works across every app. Cancel anytime.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button href="/pricing" size="lg">View plans</Button>
            <Button href="/partners" size="lg" variant="outline">Become a partner</Button>
          </div>
        </div>
      </section>
    </>
  )
}
