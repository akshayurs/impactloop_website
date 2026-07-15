'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { AuthButton } from './auth-button'
import { Logo } from './logo'
import { ThemeToggle } from './theme-toggle'

const LINKS = [
  { href: '/apps/crackloop', label: 'CrackLoop' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/partners', label: 'Partners' },
  { href: '/faq', label: 'FAQ' },
]

export function Nav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6" aria-label="Main">
        <Link href="/" aria-label="Impact Loop home">
          <Logo />
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = pathname === l.href
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`px-3 py-1.5 font-mono text-xs uppercase tracking-[0.18em] transition-colors ${
                  active
                    ? 'text-accent underline decoration-2 underline-offset-8'
                    : 'text-muted hover:text-fg hover:underline hover:decoration-line-strong hover:decoration-2 hover:underline-offset-8'
                }`}
              >
                {l.label}
              </Link>
            )
          })}
          <div className="ml-3 flex items-center gap-3">
            <AuthButton />
            <ThemeToggle />
          </div>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-line p-2"
          >
            <span aria-hidden>{open ? '✕' : '☰'}</span>
          </button>
        </div>
      </nav>
      {open ? (
        <div className="border-t border-line px-4 py-3 md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-2 py-3 text-fg hover:bg-accent-soft"
            >
              {l.label}
            </Link>
          ))}
          <div className="px-2 py-3" onClick={() => setOpen(false)}>
            <AuthButton />
          </div>
        </div>
      ) : null}
    </header>
  )
}
