import type { Metadata } from 'next'
import { DashboardRedirect } from './dashboard-redirect'

export const metadata: Metadata = { title: 'Dashboard', robots: { index: false } }

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <DashboardRedirect />
    </div>
  )
}
