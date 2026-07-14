import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { APPS } from '@/config/apps'

export default function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 sm:py-28">
        <h1 className="mx-auto max-w-2xl font-display text-4xl font-bold tracking-tight text-fg sm:text-6xl">
          Apps that build habits that stick.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted">
          Impact Loop makes focused mobile apps for learning and self-improvement — starting with
          CrackLoop for exam prep.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button href="/apps/crackloop" size="lg">Explore CrackLoop</Button>
          <Button href="/pricing" size="lg" variant="outline">See pricing</Button>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6" aria-labelledby="apps-heading">
        <h2 id="apps-heading" className="font-display text-2xl font-semibold text-fg">Our apps</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {APPS.map((app) => (
            <Card key={app.id}>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold text-fg">{app.name}</h3>
                <Badge tone={app.status === 'live' ? 'success' : 'default'}>
                  {app.status === 'live' ? 'Live on Play Store' : 'Coming soon'}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted">{app.tagline}</p>
              <div className="mt-5">
                <Button href={`/apps/${app.id}`} variant="outline" size="sm">Learn more</Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-card/50">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-2xl font-semibold text-fg">Subscribe on the web, pay less</h2>
          <p className="mt-3 max-w-2xl text-muted">
            Web subscriptions skip app-store fees, so plans here cost less than the same plans on
            Google Play. One account, works everywhere.
          </p>
          <div className="mt-6">
            <Button href="/pricing">View plans</Button>
          </div>
        </div>
      </section>
    </>
  )
}
