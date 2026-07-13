'use client'

import { useEffect, useRef, useState } from 'react'
import Reveal from '../components/Reveal'

const STEPS = [
  {
    k: '01',
    t: 'Diagnose',
    d: 'A quick adaptive check finds the exact edge of what you know — no guessing where to start.',
  },
  {
    k: '02',
    t: 'Practice',
    d: 'Focused daily loops drill the right concept at the right difficulty, building real reps.',
  },
  {
    k: '03',
    t: 'Reflect',
    d: 'Instant feedback and explanations turn every miss into a lesson you actually retain.',
  },
  {
    k: '04',
    t: 'Compound',
    d: 'Spaced resurfacing locks it in, and mastery maps show momentum stacking over time.',
  },
]

export default function Process() {
  const [active, setActive] = useState(0)
  const stepRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const idx = Number((e.target as HTMLElement).dataset.idx)
            setActive(idx)
          }
        })
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    )
    stepRefs.current.forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <section id="process" className="relative py-28 sm:py-36">
      <div className="shell">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-aurora">The method</p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="mt-4 max-w-3xl font-display text-[clamp(2rem,5vw,3.6rem)] font-semibold">
            Four moves. One loop. Repeat.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-10 lg:grid-cols-2">
          {/* Pinned visual */}
          <div className="hidden lg:block">
            <div className="sticky top-0 flex h-screen items-center">
              <div className="glass ring-glow w-full rounded-3xl p-10">
                <div
                  key={active}
                  className="font-display text-[8rem] font-semibold leading-none text-gradient"
                >
                  {STEPS[active].k}
                </div>
                <h3 className="mt-4 font-display text-3xl font-semibold text-white">
                  {STEPS[active].t}
                </h3>
                <p className="mt-3 text-lg text-white/55">{STEPS[active].d}</p>

                <div className="mt-8 flex gap-2">
                  {STEPS.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
                        i <= active ? 'bg-aurora-cyan' : 'bg-white/10'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Scrolling steps */}
          <div className="flex flex-col">
            {STEPS.map((s, i) => (
              <div
                key={s.k}
                data-idx={i}
                ref={(el) => { stepRefs.current[i] = el }}
                className="flex min-h-[60vh] flex-col justify-center lg:min-h-[80vh]"
              >
                <Reveal>
                  <div
                    className={`rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur transition-all duration-500 lg:border-transparent lg:bg-transparent lg:p-0 lg:backdrop-blur-none ${
                      active === i ? 'lg:opacity-100' : 'lg:opacity-40'
                    }`}
                  >
                    <span className="font-display text-2xl font-semibold text-aurora lg:hidden">
                      {s.k}
                    </span>
                    <h3 className="mt-2 font-display text-2xl font-semibold text-white sm:text-3xl">
                      {s.t}
                    </h3>
                    <p className="mt-3 max-w-md text-lg text-white/55">{s.d}</p>
                  </div>
                </Reveal>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
