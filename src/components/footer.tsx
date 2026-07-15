import Link from 'next/link'
import { APPS } from '@/config/apps'

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: 'Product',
    links: [
      ...APPS.map((a) => ({ href: `/apps/${a.id}`, label: a.name })),
      { href: '/pricing', label: 'Pricing' },
      { href: '/faq', label: 'FAQ' },
    ],
  },
  {
    heading: 'Program',
    links: [
      { href: '/partners', label: 'Partner program' },
      { href: '/influencer', label: 'Partner portal' },
      { href: '/account', label: 'Your account' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/terms', label: 'Terms' },
      { href: '/privacy', label: 'Privacy' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t-2 border-line-strong">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">Impact Loop</p>
          <p className="mt-3 max-w-xs text-sm text-muted">
            Focused mobile apps for learning and self-improvement, built by an indie studio in India.
          </p>
          <p className="mt-4 font-mono text-xs text-muted">
            <a href="mailto:impactloopapps@gmail.com" className="hover:text-fg">
              impactloopapps@gmail.com
            </a>
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <h3 className="font-mono text-xs uppercase tracking-[0.22em] text-fg">{col.heading}</h3>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="transition-colors hover:text-accent">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Oversized wordmark, editorial-poster style */}
      <div aria-hidden className="select-none overflow-hidden border-t border-line px-4 sm:px-6">
        <p className="mx-auto max-w-6xl whitespace-nowrap font-display text-[16vw] font-bold leading-none tracking-tight text-fg/5 md:text-[9rem]">
          IMPACT LOOP
        </p>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 font-mono text-xs text-muted sm:px-6">
          <p>© {new Date().getFullYear()} IMPACT LOOP</p>
          <p>INR · RAZORPAY — INTERNATIONAL COMING SOON</p>
        </div>
      </div>
    </footer>
  )
}
