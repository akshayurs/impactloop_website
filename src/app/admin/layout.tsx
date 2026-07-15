import type { Metadata } from 'next'
import { AdminGate } from '@/components/admin/admin-gate'
import { AdminTabs } from '@/components/admin/admin-tabs'

export const metadata: Metadata = { title: 'Admin', robots: { index: false } }

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-fg">Admin</h1>
      <AdminTabs />
      <div className="mt-6">
        <AdminGate>{children}</AdminGate>
      </div>
    </div>
  )
}
