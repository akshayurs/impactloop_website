'use client'

import Reveal from '../components/Reveal'
import Magnetic from '../components/Magnetic'

export default function CTA() {
  return (
    <section id="cta" className="relative py-28 sm:py-36">
      <div className="shell">
        <Reveal>
          <div className="ring-glow relative overflow-hidden rounded-[2.5rem] border border-white/10 px-6 py-16 text-center sm:px-12 sm:py-24">
            <div
              aria-hidden
              className="absolute inset-0 -z-10 bg-[conic-gradient(from_180deg_at_50%_50%,#7c5cff33,#22d3ee33,#e879f933,#7c5cff33)]"
            />
            <div aria-hidden className="absolute inset-0 -z-10 bg-ink/40 backdrop-blur-md" />

            <h2 className="mx-auto max-w-3xl font-display text-[clamp(2rem,6vw,4rem)] font-semibold">
              Start your loop today.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-white/65">
              Be first to practice with CrackLoop and shape what Impact Loop builds next.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Magnetic strength={0.5}>
                <a
                  href="mailto:impactloopapps@gmail.com?subject=CrackLoop%20early%20access"
                  data-cursor
                  className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-base font-semibold text-ink transition-transform hover:scale-[1.03]"
                >
                  Request early access →
                </a>
              </Magnetic>
              <a
                href="mailto:impactloopapps@gmail.com"
                data-cursor
                className="text-base font-medium text-white/70 transition-colors hover:text-white"
              >
                impactloopapps@gmail.com
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
