'use client'

import Counter from '../components/Counter'
import Reveal from '../components/Reveal'

const STATS = [
  { value: 12000, suffix: '+', label: 'Learners in the loop' },
  { value: 480, suffix: '', label: 'Curated problems' },
  { value: 1.2, suffix: 'M', decimals: 1, label: 'Loops closed' },
  { value: 4.9, suffix: '★', decimals: 1, label: 'Average rating' },
]

export default function Stats() {
  return (
    <section className="relative py-20">
      <div className="shell">
        <div className="glass ring-glow grid grid-cols-2 gap-y-10 rounded-3xl px-6 py-12 sm:px-10 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 90} className="text-center">
              <div className="font-display text-[clamp(2.2rem,5vw,3.4rem)] font-semibold text-gradient">
                <Counter
                  value={s.value}
                  suffix={s.suffix}
                  decimals={s.decimals ?? 0}
                />
              </div>
              <p className="mt-2 text-sm text-white/50">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
