import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
      <h1 className="font-display text-4xl font-bold text-fg">Page not found</h1>
      <p className="mt-3 text-muted">The page you’re looking for doesn’t exist.</p>
      <div className="mt-8">
        <Button href="/">Back home</Button>
      </div>
    </div>
  )
}
