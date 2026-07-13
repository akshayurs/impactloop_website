'use client'

import { ReactNode, useRef } from 'react'
import { prefersReducedMotion } from '../lib/useReducedMotion'

interface Props {
  children: ReactNode
  className?: string
  strength?: number
}

// Pulls its child toward the cursor while hovered; springs back on leave.
// Disabled on touch and under reduced motion.
export default function Magnetic({ children, className = '', strength = 0.4 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const enabled =
    typeof window !== 'undefined' &&
    window.matchMedia('(pointer: fine)').matches &&
    !prefersReducedMotion()

  const onMove = (e: React.MouseEvent) => {
    if (!enabled || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const x = e.clientX - (r.left + r.width / 2)
    const y = e.clientY - (r.top + r.height / 2)
    ref.current.style.transform = `translate(${x * strength}px, ${y * strength}px)`
  }

  const reset = () => {
    if (ref.current) ref.current.style.transform = 'translate(0, 0)'
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      className={`inline-block transition-transform duration-300 ease-out will-change-transform ${className}`}
    >
      {children}
    </div>
  )
}
