'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Something broke</p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-fg">This page hit a snag.</h1>
      <p className="mt-4 text-muted">
        A temporary error stopped this page from loading. It has been logged. Try again in a moment.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-fg hover:bg-accent-strong"
        >
          Try again
        </button>
        <Link href="/" className="rounded-full border-2 border-line px-5 py-2 text-sm text-fg hover:border-line-strong">
          Back to home
        </Link>
      </div>
    </main>
  )
}
