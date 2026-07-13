'use client'

import { Suspense, lazy, useEffect, useState } from 'react'
import SplitText from '../components/SplitText'
import Magnetic from '../components/Magnetic'
import { useInView } from '../lib/useInView'
import { useReducedMotion } from '../lib/useReducedMotion'
import { isWebGLAvailable, isLowPowerDevice } from '../lib/webgl'
import { scrollToSection } from '../lib/useSmoothScroll'

const HeroCanvas = lazy(() => import('../three/HeroCanvas'))

export default function Hero() {
  const reduced = useReducedMotion()
  const [webgl, setWebgl] = useState(false)
  const [lowPower, setLowPower] = useState(false)
  const [visible, setVisible] = useState(true)
  const { ref, inView } = useInView<HTMLElement>({ once: false, threshold: 0 })

  useEffect(() => {
    setWebgl(isWebGLAvailable())
    setLowPower(isLowPowerDevice())
    const onVis = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const show3D = webgl && !reduced
  const active = show3D && inView && visible

  return (
    <section
      ref={ref}
      id="top"
      className="relative flex min-h-[100svh] items-center overflow-hidden"
    >
      {/* 3D layer (or animated gradient fallback) */}
      <div className="absolute inset-0 z-0">
        {show3D ? (
          <Suspense fallback={null}>
            <HeroCanvas active={active} lowPower={lowPower} />
          </Suspense>
        ) : (
          <div className="absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[conic-gradient(from_0deg,#7c5cff,#22d3ee,#e879f9,#7c5cff)] opacity-40 blur-3xl" />
        )}
      </div>

      {/* Legibility scrims over the 3D layer */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[5] bg-gradient-to-t from-ink via-ink/25 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[5] bg-gradient-to-r from-ink/70 via-ink/10 to-transparent"
      />

      {/* Content */}
      <div className="pointer-events-none relative z-10 w-full">
        <div className="shell">
          <div className="max-w-3xl">
            <p className="reveal is-visible mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur">
              <span className="text-aurora">✦</span> Indie app studio
            </p>

            <h1 className="font-display text-[clamp(2.6rem,8vw,5.6rem)] font-semibold leading-[1.02]">
              <SplitText text="We build apps that" trigger="mount" className="block" />
              <SplitText
                text="loop effort into impact."
                trigger="mount"
                delay={0.35}
                className="block text-aurora"
              />
            </h1>

            <p className="reveal is-visible mt-7 max-w-xl text-pretty text-lg text-white/65 sm:text-xl">
              Impact Loop crafts focused products that compound everyday practice into real
              momentum — starting with{' '}
              <span className="font-medium text-white">CrackLoop</span>, our interview-prep
              companion.
            </p>

            <div className="pointer-events-auto mt-9 flex flex-wrap items-center gap-4">
              <Magnetic>
                <a
                  href="#crackloop"
                  data-cursor
                  onClick={(e) => {
                    e.preventDefault()
                    scrollToSection('#crackloop')
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-semibold text-ink transition-transform hover:scale-[1.03]"
                >
                  Explore CrackLoop →
                </a>
              </Magnetic>
              <a
                href="#concept"
                data-cursor
                onClick={(e) => {
                  e.preventDefault()
                  scrollToSection('#concept')
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-7 py-3.5 text-base font-medium text-white/85 transition-colors hover:border-white/40 hover:text-white"
              >
                The concept
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <div className="pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2">
        <div className="flex h-10 w-6 justify-center rounded-full border border-white/25 p-1.5">
          <span className="h-2 w-1 animate-bounce rounded-full bg-white/70" />
        </div>
      </div>
    </section>
  )
}
