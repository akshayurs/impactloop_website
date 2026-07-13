'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useInView } from '../lib/useInView'
import { prefersReducedMotion } from '../lib/useReducedMotion'

interface Props {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  duration?: number
  className?: string
}

export default function Counter({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 2,
  className = '',
}: Props) {
  const { ref, inView } = useInView<HTMLSpanElement>({ threshold: 0.5 })
  const out = useRef<HTMLSpanElement>(null)

  const format = (n: number) =>
    prefix +
    n.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) +
    suffix

  useEffect(() => {
    if (!inView || !out.current) return
    if (prefersReducedMotion()) {
      out.current.textContent = format(value)
      return
    }
    const obj = { v: 0 }
    const tween = gsap.to(obj, {
      v: value,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        if (out.current) out.current.textContent = format(obj.v)
      },
    })
    return () => {
      tween.kill()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value])

  return (
    <span ref={ref} className={className}>
      <span ref={out}>{format(0)}</span>
    </span>
  )
}
