import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl font-bold text-fg">{app.name}</h1>
        <Badge tone={app.status === 'live' ? 'success' : 'default'}>
          {app.status === 'live' ? 'Live on Play Store' : 'Coming soon'}
        </Badge>
      </div>
      <p className="mt-3 max-w-2xl text-lg text-muted">{app.description}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button href={app.playStoreUrl} size="lg">Get it on Google Play</Button>
        <Button href="/pricing" size="lg" variant="outline">Web pricing</Button>
      </div>

      <section className="mt-14" aria-label="Screenshots">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex aspect-[9/19] items-center justify-center rounded-2xl border border-line bg-card text-xs text-muted"
            >
              {app.name} screenshot {i}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14" aria-labelledby="features-heading">
        <h2 id="features-heading" className="font-display text-2xl font-semibold text-fg">Features</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {app.features.map((f) => (
            <Card key={f} className="p-4">
              <p className="text-sm text-fg">{f}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
