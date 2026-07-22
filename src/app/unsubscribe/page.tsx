import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CATEGORY_LABELS, isOptOutCategory, setEmailPref, verifyUnsubToken } from '@/lib/server/email/prefs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Email preferences — Impact Loop', robots: { index: false } }

type Search = { u?: string; c?: string; t?: string; done?: string }

// Preference changes happen only through this server action (a POST), never on GET —
// so link scanners and prefetchers that fetch the emailed link can't silently opt a
// user out.
async function applyPref(formData: FormData) {
  'use server'
  const u = String(formData.get('u') ?? '')
  const c = String(formData.get('c') ?? '')
  const t = String(formData.get('t') ?? '')
  const resub = formData.get('resub') === '1'
  const params = new URLSearchParams({ u, c, t })
  if (isOptOutCategory(c) && verifyUnsubToken(u, c, t)) {
    await setEmailPref(u, c, resub)
    params.set('done', resub ? 'resubscribed' : 'unsubscribed')
  }
  redirect(`/unsubscribe?${params}`)
}

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<Search> }) {
  const { u = '', c = '', t = '', done } = await searchParams
  const valid = isOptOutCategory(c) && verifyUnsubToken(u, c, t)
  const label = isOptOutCategory(c) ? CATEGORY_LABELS[c] : ''

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Email preferences</p>

      {!valid ? (
        <>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">This link doesn&apos;t look right.</h1>
          <p className="mt-4 text-muted">
            The unsubscribe link is invalid or has expired. Please use the link from the bottom of a recent email, or
            contact us at <a className="underline" href="mailto:impactloopapps@gmail.com">impactloopapps@gmail.com</a>.
          </p>
        </>
      ) : done === 'unsubscribed' ? (
        <>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">You&apos;re unsubscribed.</h1>
          <p className="mt-4 text-muted">
            You will no longer receive emails about {label}. Service emails about your purchases and account still get
            delivered.
          </p>
          <form action={applyPref} className="mt-6">
            <input type="hidden" name="u" value={u} />
            <input type="hidden" name="c" value={c} />
            <input type="hidden" name="t" value={t} />
            <input type="hidden" name="resub" value="1" />
            <button type="submit" className="rounded-full border-2 border-line px-5 py-2 text-sm hover:border-line-strong">
              Changed your mind? Re-subscribe
            </button>
          </form>
        </>
      ) : done === 'resubscribed' ? (
        <>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Welcome back.</h1>
          <p className="mt-4 text-muted">You&apos;re re-subscribed to emails about {label}.</p>
        </>
      ) : (
        <>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Unsubscribe?</h1>
          <p className="mt-4 text-muted">
            Stop receiving emails about {label}? Service emails about your purchases and account will still be
            delivered.
          </p>
          <form action={applyPref} className="mt-6">
            <input type="hidden" name="u" value={u} />
            <input type="hidden" name="c" value={c} />
            <input type="hidden" name="t" value={t} />
            <button type="submit" className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-fg hover:bg-accent-strong">
              Unsubscribe from {label}
            </button>
          </form>
        </>
      )}

      <Link href="/" className="mt-10 text-sm text-muted underline hover:text-fg">
        Back to Impact Loop
      </Link>
    </main>
  )
}
