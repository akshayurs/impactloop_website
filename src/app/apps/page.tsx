import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { APPS } from '@/config/apps'

export const metadata: Metadata = {
  title: 'Apps',
  description: 'Focused learning apps by Impact Loop — each built around one daily habit loop.',
}

/* Placeholders for loops still in the pipeline. */
const FUTURE_SLOTS = [
  { hint: 'In the works', body: 'The next loop — same habit engine, new subject.' },
  { hint: 'On the roadmap', body: 'More focused apps are on the way.' },
]

export default function AppsPage() {
  const comingSoonCount = APPS.filter((a) => a.status !== 'live').length
  const slots = FUTURE_SLOTS.slice(0, Math.max(0, 2 - comingSoonCount))

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <p className="kicker">The apps</p>
      <h1 className="mt-4 font-display text-4xl font-bold text-fg sm:text-5xl">Every loop we&rsquo;ve built.</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        Impact Loop is an indie studio making focused learning apps — each one built around a single
        daily habit loop. One account and one set of web plans work across all of them.
      </p>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {APPS.map((app) =>
          app.status === 'live' ? (
            <Link key={app.id} href={`/apps/${app.id}`} className="group">
              <article className="card-lift flex h-full gap-5 rounded-2xl border-2 border-line-strong bg-card p-6">
                <Image
                  src={app.screenshots[0]}
                  alt={`${app.name} app`}
                  width={120}
                  height={210}
                  className="h-40 w-24 shrink-0 rounded-xl border-2 border-line-strong object-cover object-top"
                />
                <div className="flex flex-col">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-2xl font-bold text-fg">{app.name}</h2>
                    <Badge tone="success">Live</Badge>
                  </div>
                  <p className="mt-1 font-mono text-xs uppercase tracking-[0.18em] text-accent">{app.tagline}</p>
                  <p className="mt-3 text-sm text-muted line-clamp-4">{app.description}</p>
                  <p className="mt-auto pt-4 font-mono text-xs uppercase tracking-[0.18em] text-accent">
                    Open app page{' '}
                    <span aria-hidden className="inline-block transition-transform group-hover:translate-x-1">→</span>
                  </p>
                </div>
              </article>
            </Link>
          ) : (
            <article key={app.id} className="flex h-full flex-col rounded-2xl border-2 border-dashed border-line p-6">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl font-bold text-fg">{app.name}</h2>
                <Badge>Coming soon</Badge>
              </div>
              <p className="mt-1 font-mono text-xs uppercase tracking-[0.18em] text-muted">{app.tagline}</p>
              <p className="mt-3 text-sm text-muted">{app.description}</p>
            </article>
          ),
        )}

        {slots.map((slot) => (
          <article
            key={slot.hint}
            className="flex h-full min-h-40 flex-col justify-between rounded-2xl border-2 border-dashed border-line p-6"
          >
            <p aria-hidden className="loop-ring inline-block h-8 w-8 opacity-60" />
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">{slot.hint}</p>
              <p className="mt-2 text-sm text-muted">{slot.body}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="dot-grid mt-16 rounded-2xl border-2 border-line-strong">
        <div className="px-6 py-12 text-center">
          <h2 className="font-display text-2xl font-bold text-fg">Web plans cost less than the stores.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Subscribe on the web to skip app-store fees. One account works across every Impact Loop app.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button href="/pricing" size="md">View pricing</Button>
            <Button href="/partners" size="md" variant="outline">Become a partner</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
