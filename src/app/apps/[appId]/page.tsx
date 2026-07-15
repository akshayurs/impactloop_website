import Image from 'next/image'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { APPS, getApp } from '@/config/apps'

export function generateStaticParams() {
  return APPS.map((a) => ({ appId: a.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ appId: string }> }): Promise<Metadata> {
  const { appId } = await params
  const app = getApp(appId)
  return app ? { title: app.name, description: app.tagline } : {}
}

export default async function AppPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params
  const app = getApp(appId)
  if (!app) notFound()

  return (
    <>
      {/* ——— Hero ——— */}
      <section className="hero-spot relative overflow-hidden">
        <div aria-hidden className="orbit left-[70%] top-[-20rem] h-[40rem] w-[40rem]" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="kicker fade-up">The first loop</p>
            <div className="fade-up fade-up-1 mt-6 flex flex-wrap items-center gap-4">
              <h1 className="font-display text-5xl font-bold text-fg sm:text-6xl">{app.name}</h1>
              <Badge tone={app.status === 'live' ? 'success' : 'default'}>
                {app.status === 'live' ? 'Live on Play Store' : 'Coming soon'}
              </Badge>
            </div>
            <p className="fade-up fade-up-1 mt-2 font-mono text-sm uppercase tracking-[0.22em] text-accent">
              {app.tagline}
            </p>
            <p className="fade-up fade-up-2 mt-5 max-w-xl text-lg text-muted">{app.description}</p>
            <div className="fade-up fade-up-3 mt-8 flex flex-wrap gap-3">
              <Button href={app.playStoreUrl} size="lg" target="_blank">Get it on Google Play</Button>
              <Button href="/pricing" size="lg" variant="outline">Web pricing</Button>
            </div>
          </div>
          <div className="fade-up fade-up-2 relative mx-auto w-64 sm:w-72">
            <div aria-hidden className="loop-ring absolute -right-8 -top-6 h-20 w-20 opacity-60" />
            <Image
              src={app.screenshots[0]}
              alt={`${app.name} main screen`}
              width={450}
              height={780}
              priority
              className="card-lift -rotate-2 rounded-2xl border-2 border-line-strong"
            />
          </div>
        </div>
      </section>

      {/* ——— Topic marquee ——— */}
      <section aria-label="Topics covered" className="border-y-2 border-line-strong bg-bg-raised py-4">
        <div className="marquee">
          <div className="marquee-track">
            {[0, 1].map((dup) => (
              <span key={dup} aria-hidden={dup === 1} className="flex gap-12">
                {app.topics.map((t) => (
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

      {/* ——— 01 · Features ——— */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6" aria-labelledby="features-heading">
        <div className="flex items-baseline justify-between border-b-2 border-line-strong pb-4">
          <p className="kicker">01 — What&rsquo;s inside</p>
        </div>
        <h2 id="features-heading" className="mt-8 max-w-2xl font-display text-4xl font-bold text-fg">
          Everything in {app.name}.
        </h2>
        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border-2 border-line-strong bg-line-strong sm:grid-cols-2 lg:grid-cols-3">
          {app.featureDetails.map((f, i) => (
            <article key={f.title} className="reveal bg-card p-8">
              <span aria-hidden className="font-mono text-sm font-bold text-accent">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-3 font-display text-xl font-semibold text-fg">{f.title}</h3>
              <p className="mt-2 text-sm text-muted">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ——— 02 · Screens ——— */}
      <section className="border-y-2 border-line-strong bg-bg-raised" aria-labelledby="screens-heading">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="flex items-baseline justify-between border-b border-line pb-4">
            <p className="kicker">02 — Screens</p>
          </div>
          <h2 id="screens-heading" className="mt-8 font-display text-4xl font-bold text-fg">
            See it in motion.
          </h2>
          <div className="-mx-4 mt-10 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
            <div className="flex w-max gap-6">
              {app.screenshots.map((src, i) => (
                <Image
                  key={src}
                  src={src}
                  alt={`${app.name} screen ${i + 1}`}
                  width={280}
                  height={470}
                  className={`card-lift w-56 rounded-2xl border-2 border-line-strong ${i % 2 ? 'rotate-1' : '-rotate-1'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ——— CTA ——— */}
      <section className="dot-grid">
        <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
          <p className="kicker justify-center">Start today</p>
          <h2 className="mt-6 font-display text-4xl font-bold text-fg sm:text-5xl">
            Your first <span className="loop-underline">loop</span> takes ten minutes.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted">
            Free to download on Google Play. Upgrade on the web when you are ready — and pay less.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button href={app.playStoreUrl} size="lg" target="_blank">Download {app.name}</Button>
            <Button href="/pricing" size="lg" variant="outline">See plans</Button>
          </div>
        </div>
      </section>
    </>
  )
}
