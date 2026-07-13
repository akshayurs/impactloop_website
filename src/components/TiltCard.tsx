'use client'

import { ReactNode, useRef } from 'react'
import { prefersReducedMotion } from '../lib/useReducedMotion'

interface Props {
  children: ReactNode
  className?: string
  max?: number
}

// Hover 3D tilt with a moving glare highlight. Pointer-fine only.
export default function TiltCard({ children, className = '', max = 9 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const enabled =
    typeof window !== 'undefined' &&
    window.matchMedia('(pointer: fine)').matches &&
    !prefersReducedMotion()

  const onMove = (e: React.MouseEvent) => {
    if (!enabled || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    const rx = (0.5 - py) * max * 2
    const ry = (px - 0.5) * max * 2
    ref.current.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`
    ref.current.style.setProperty('--gx', `${px * 100}%`)
    ref.current.style.setProperty('--gy', `${py * 100}%`)
  }

  const reset = () => {
    if (ref.current) ref.current.style.transform = 'perspective(900px) rotateX(0) rotateY(0)'
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      className={`relative transition-transform duration-200 ease-out will-change-transform ${className}`}
    >
      {children}
      {enabled && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-70 mix-blend-screen"
          style={{
            backgroundImage:
              'radial-gradient(240px circle at var(--gx,50%) var(--gy,50%), rgba(124,92,255,0.22), transparent 55%)',
          }}
        />
      )}
    </div>
  )
}
