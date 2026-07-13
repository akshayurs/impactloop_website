import Logo from './Logo'
import { scrollToSection } from '../lib/useSmoothScroll'

const STUDIO = [
  { name: 'CrackLoop', tag: 'Interview prep, looped', status: 'Live' },
  { name: 'FocusLoop', tag: 'Deep-work timer & rituals', status: 'Soon' },
  { name: 'HabitLoop', tag: 'Compounding daily habits', status: 'Soon' },
]

export default function Footer() {
  const top = (e: React.MouseEvent) => {
    e.preventDefault()
    scrollToSection('#top')
  }

  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-ink2/60 py-16">
      <div className="shell">
        <div className="grid gap-12 md:grid-cols-[1.2fr_1fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-sm text-balance text-white/55">
              An indie app studio building products that turn everyday effort into a continuous loop
              of learning and impact.
            </p>
            <a
              href="mailto:impactloopapps@gmail.com"
              data-cursor
              className="mt-6 inline-flex items-center gap-2 text-lg font-medium text-white transition-colors hover:text-aurora"
            >
              impactloopapps@gmail.com
            </a>
            <div className="mt-6 flex gap-3">
              {['Twitter', 'GitHub', 'LinkedIn'].map((s) => (
                <a
                  key={s}
                  href="#"
                  data-cursor
                  aria-label={s}
                  className="glass flex h-10 w-10 items-center justify-center rounded-full text-xs text-white/70 transition-colors hover:text-white"
                >
                  {s[0]}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-white/40">
              From the studio
            </h3>
            <ul className="mt-5 flex flex-col gap-3">
              {STUDIO.map((app) => (
                <li
                  key={app.name}
                  className="glass flex items-center justify-between rounded-xl px-4 py-3"
                >
                  <span>
                    <span className="font-display font-medium text-white">{app.name}</span>
                    <span className="ml-2 text-sm text-white/45">{app.tag}</span>
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      app.status === 'Live'
                        ? 'bg-aurora-cyan/15 text-aurora-cyan'
                        : 'bg-white/10 text-white/50'
                    }`}
                  >
                    {app.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-white/40 sm:flex-row">
          <p>© {new Date().getFullYear()} Impact Loop. Crafted with intent.</p>
          <div className="flex items-center gap-6">
            <a
              href="/terms.html"
              data-cursor
              className="text-white/60 transition-colors hover:text-white"
            >
              Terms
            </a>
            <a
              href="/privacy.html"
              data-cursor
              className="text-white/60 transition-colors hover:text-white"
            >
              Privacy
            </a>
            <a
              href="#top"
              onClick={top}
              data-cursor
              className="inline-flex items-center gap-2 text-white/60 transition-colors hover:text-white"
            >
              Back to top ↑
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
