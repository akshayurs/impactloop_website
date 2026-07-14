'use client'
import Link from 'next/link'
import { useState } from 'react'
import { AuthButton } from './auth-button'
import { Logo } from './logo'
import { ThemeToggle } from './theme-toggle'

const LINKS = [
  { href: '/apps/crackloop', label: 'CrackLoop' },
  { href: '/pricing', label: 'Pricing' },
]

export function Nav() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6" aria-label="Main">
        <Link href="/" aria-label="Impact Loop home">
          <Logo />
        </Link>
        <div className="hidden items-center gap-6 md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-muted hover:text-fg">
              {l.label}
            </Link>
          ))}
          <AuthButton />
          <ThemeToggle />
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
              className="block rounded-lg px-2 py-3 text-fg hover:bg-card"
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
