import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="hero-spot">
      <div className="mx-auto max-w-3xl px-4 py-32 text-center sm:px-6">
        <p aria-hidden className="font-mono text-7xl font-bold text-accent">404</p>
        <h1 className="mt-4 font-display text-4xl font-bold text-fg">
          This loop is <span className="loop-underline">open.</span>
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-muted">
          The page you’re looking for doesn’t exist or has moved.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button href="/">Back home</Button>
          <Button href="/pricing" variant="outline">See pricing</Button>
        </div>
      </div>
    </div>
  )
}
