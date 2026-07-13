'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Reveal from '../components/Reveal'
import { prefersReducedMotion } from '../lib/useReducedMotion'

gsap.registerPlugin(ScrollTrigger)

const NODES = [
  { k: '01', t: 'Learn', d: 'Tight feedback turns every attempt into a lesson you keep.' },
  { k: '02', t: 'Apply', d: 'Ship the lesson into practice while it is still fresh.' },
  { k: '03', t: 'Compound', d: 'Small loops stack into outsized, durable momentum.' },
]

export default function Concept() {
  const pathRef = useRef<SVGPathElement>(null)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const path = pathRef.current
    const section = sectionRef.current
    if (!path || !section) return

    const len = path.getTotalLength()
    gsap.set(path, { strokeDasharray: len })

    if (prefersReducedMotion()) {
      gsap.set(path, { strokeDashoffset: 0 })
      return
    }

    gsap.set(path, { strokeDashoffset: len })
    const tween = gsap.to(path, {
      strokeDashoffset: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top 75%',
        end: 'bottom 60%',
        scrub: 1,
      },
    })
    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
  }, [])

  return (
    <section ref={sectionRef} id="concept" className="relative py-28 sm:py-36">
      <div className="shell">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-aurora">The concept</p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="mt-4 max-w-3xl font-display text-[clamp(2rem,5vw,3.6rem)] font-semibold">
            Every product is a <span className="text-aurora">loop</span>, not a launch.
          </h2>
        </Reveal>
        <Reveal delay={140}>
          <p className="mt-6 max-w-2xl text-lg text-white/60">
            We design for the cycle that actually builds skill: learn something, apply it
            immediately, and let the gains compound. The loop is the product.
          </p>
        </Reveal>

        <div className="mt-16 grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div className="relative">
            <svg viewBox="0 0 500 260" className="w-full" aria-hidden>
              <defs>
                <linearGradient id="conceptStroke" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#7C5CFF" />
                  <stop offset="50%" stopColor="#22D3EE" />
                  <stop offset="100%" stopColor="#E879F9" />
                </linearGradient>
              </defs>
              <path
                ref={pathRef}
                d="M250 130 C 200 40, 40 40, 40 130 C 40 220, 200 220, 250 130 C 300 40, 460 40, 460 130 C 460 220, 300 220, 250 130 Z"
                fill="none"
                stroke="url(#conceptStroke)"
                strokeWidth="6"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <ul className="flex flex-col gap-4">
            {NODES.map((n, i) => (
              <Reveal as="li" key={n.k} delay={i * 90}>
                <div className="glass flex items-start gap-5 rounded-2xl p-5">
                  <span className="font-display text-2xl font-semibold text-aurora">{n.k}</span>
                  <div>
                    <h3 className="text-xl font-semibold text-white">{n.t}</h3>
                    <p className="mt-1 text-white/55">{n.d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
