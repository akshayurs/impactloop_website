'use client'

import Reveal from '../components/Reveal'
import TiltCard from '../components/TiltCard'

const FEATURES = [
  {
    icon: '🔁',
    title: 'Loop-first design',
    body: 'Every feature is built around tight, repeatable cycles — the unit of real progress.',
    span: 'lg:col-span-2',
  },
  {
    icon: '🧠',
    title: 'Adaptive difficulty',
    body: 'Content meets you exactly at your edge and moves as you do.',
    span: '',
  },
  {
    icon: '⏱️',
    title: 'Spaced repetition',
    body: 'Resurfaces what you’re about to forget, right on time.',
    span: '',
  },
  {
    icon: '🏗️',
    title: 'Real-world depth',
    body: 'Trade-offs and systems from production, not just textbook puzzles.',
    span: '',
  },
  {
    icon: '📈',
    title: 'Progress that compounds',
    body: 'Streaks, mastery maps, and momentum you can feel build week over week.',
    span: 'lg:col-span-2',
  },
  {
    icon: '✨',
    title: 'Crafted, not bloated',
    body: 'Fast, focused, delightful. No clutter between you and the work.',
    span: '',
  },
]

export default function Features() {
  return (
    <section id="features" className="relative py-28 sm:py-36">
      <div className="shell">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-aurora">
            Why it works
          </p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="mt-4 max-w-3xl font-display text-[clamp(2rem,5vw,3.6rem)] font-semibold">
            Built on the principles that actually make skill stick.
          </h2>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 90} className={f.span}>
              <TiltCard className="h-full rounded-3xl">
                <div className="glass flex h-full flex-col rounded-3xl p-7">
                  <span className="text-3xl" aria-hidden>
                    {f.icon}
                  </span>
                  <h3 className="mt-5 font-display text-xl font-semibold text-white">{f.title}</h3>
                  <p className="mt-2 text-white/55">{f.body}</p>
                </div>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
