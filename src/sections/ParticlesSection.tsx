'use client'

import { Suspense, lazy, useEffect, useState } from 'react'
import SplitText from '../components/SplitText'
import Reveal from '../components/Reveal'
import { useInView } from '../lib/useInView'
import { useReducedMotion } from '../lib/useReducedMotion'
import { isWebGLAvailable, isLowPowerDevice } from '../lib/webgl'

const ParticleScene = lazy(() => import('../three/ParticleScene'))

export default function ParticlesSection() {
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
    <section ref={ref} className="relative flex min-h-[90vh] items-center overflow-hidden py-24">
      <div className="absolute inset-0 z-0">
        {show3D ? (
          <Suspense fallback={null}>
            <ParticleScene active={active} lowPower={lowPower} />
          </Suspense>
        ) : (
          <div className="absolute left-1/2 top-1/2 h-[60vmin] w-[60vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,#22d3ee55,transparent_70%)] blur-2xl" />
        )}
      </div>

      <div className="relative z-10 w-full text-center">
        <div className="shell">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-aurora-cyan">
              Thousands of small reps
            </p>
          </Reveal>
          <h2 className="mx-auto mt-5 max-w-3xl font-display text-[clamp(2rem,6vw,4.2rem)] font-semibold">
            <SplitText text="Every point is a rep." className="block" />
            <SplitText text="The loop is the magic." delay={0.25} className="block text-aurora" />
          </h2>
          <Reveal delay={120}>
            <p className="mx-auto mt-6 max-w-xl text-lg text-white/60">
              Tiny efforts, repeated and connected, swirl into something far greater than their
              sum. That’s the whole idea.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
