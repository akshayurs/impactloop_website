'use client'

import { useEffect, useState } from 'react'
import Logo from './Logo'
import Magnetic from './Magnetic'
import AuthButton from './AuthButton'
import { scrollToSection } from '../lib/useSmoothScroll'

const LINKS = [
  { label: 'Concept', href: '#concept' },
  { label: 'CrackLoop', href: '#crackloop' },
  { label: 'Features', href: '#features' },
  { label: 'Process', href: '#process' },
]

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const go = (e: React.MouseEvent, href: string) => {
    e.preventDefault()
    setOpen(false)
    scrollToSection(href)
  }

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled ? 'py-3' : 'py-5'
      }`}
    >
      <div className="shell">
        <nav
          className={`flex items-center justify-between rounded-2xl px-4 py-2.5 transition-all duration-500 sm:px-5 ${
            scrolled ? 'glass ring-glow' : 'bg-transparent'
          }`}
        >
          <a href="#top" onClick={(e) => go(e, '#top')} data-cursor aria-label="Impact Loop home">
            <Logo />
          </a>

          <ul className="hidden items-center gap-8 md:flex">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={(e) => go(e, l.href)}
                  data-cursor
                  className="text-sm font-medium text-white/70 transition-colors hover:text-white"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-4 md:flex">
            <AuthButton />
            <Magnetic>
              <a
                href="#cta"
                onClick={(e) => go(e, '#cta')}
                data-cursor
                className="inline-flex items-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink transition-transform hover:scale-[1.03]"
              >
                Get CrackLoop
              </a>
            </Magnetic>
          </div>

          <button
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            <div className="relative h-4 w-6">
              <span
                className={`absolute left-0 h-0.5 w-6 bg-white transition-all duration-300 ${
                  open ? 'top-1.5 rotate-45' : 'top-0'
                }`}
              />
              <span
                className={`absolute left-0 top-1.5 h-0.5 w-6 bg-white transition-all duration-300 ${
                  open ? 'opacity-0' : 'opacity-100'
                }`}
              />
              <span
                className={`absolute left-0 h-0.5 w-6 bg-white transition-all duration-300 ${
                  open ? 'top-1.5 -rotate-45' : 'top-3'
                }`}
              />
            </div>
          </button>
        </nav>

        {/* Mobile menu */}
        <div
          className={`mt-2 overflow-hidden rounded-2xl transition-all duration-500 md:hidden ${
            open ? 'max-h-96 opacity-100' : 'pointer-events-none max-h-0 opacity-0'
          }`}
        >
          <ul className="glass flex flex-col gap-1 p-3">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={(e) => go(e, l.href)}
                  className="block rounded-xl px-4 py-3 text-base font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white"
                >
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <a
                href="#cta"
                onClick={(e) => go(e, '#cta')}
                className="mt-1 block rounded-xl bg-white px-4 py-3 text-center text-base font-semibold text-ink"
              >
                Get CrackLoop
              </a>
            </li>
          </ul>
        </div>
      </div>
    </header>
  )
}
