import Link from 'next/link'
import { APPS } from '@/config/apps'
import { Logo } from './logo'

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-muted">Apps that build habits that stick.</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-fg">Apps</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {APPS.map((a) => (
              <li key={a.id}>
                <Link href={`/apps/${a.id}`} className="hover:text-fg">
                  {a.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-fg">Legal</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>
              <Link href="/terms" className="hover:text-fg">Terms</Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-fg">Privacy</Link>
            </li>
          </ul>
        </div>
      </div>
      <p className="border-t border-line py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} Impact Loop
      </p>
    </footer>
  )
}
