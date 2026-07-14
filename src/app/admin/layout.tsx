import Link from 'next/link'
import type { Metadata } from 'next'
import { AdminGate } from '@/components/admin/admin-gate'

export const metadata: Metadata = { title: 'Admin', robots: { index: false } }

const SECTIONS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/plans', label: 'Plans' },
  { href: '/admin/settings', label: 'Settings' },
  { href: '/admin/webhooks', label: 'Webhooks' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-2xl font-bold text-fg">Admin</h1>
      <nav aria-label="Admin sections" className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="whitespace-nowrap rounded-full border border-line px-4 py-1.5 text-sm text-muted hover:bg-card hover:text-fg"
          >
            {s.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">
        <AdminGate>{children}</AdminGate>
      </div>
    </div>
  )
}
