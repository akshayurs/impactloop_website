'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const SECTIONS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/influencers', label: 'Influencers' },
  { href: '/admin/plans', label: 'Pricing' },
  { href: '/admin/emails', label: 'Emails' },
  { href: '/admin/settings', label: 'Settings' },
  { href: '/admin/webhooks', label: 'Webhooks' },
]

export function AdminTabs() {
  const pathname = usePathname()
  return (
    <nav aria-label="Admin sections" className="mt-4 flex gap-2 overflow-x-auto pb-2">
      {SECTIONS.map((s) => {
        const active = pathname === s.href
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition-colors ${
              active
                ? 'border-accent/50 bg-accent-soft text-fg'
                : 'border-line text-muted hover:bg-card hover:text-fg'
            }`}
          >
            {s.label}
          </Link>
        )
      })}
    </nav>
  )
}
