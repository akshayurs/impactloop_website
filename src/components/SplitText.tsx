'use client'

import { ElementType, useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { prefersReducedMotion } from '../lib/useReducedMotion'

interface Props {
  text: string
  as?: ElementType
  className?: string
  delay?: number
  stagger?: number
  trigger?: 'mount' | 'inview'
}

// Staggered per-character reveal. Each word is kept whole (no mid-word wrapping);
// characters rise out of an overflow-clipped mask.
export default function SplitText({
  text,
  as: Tag = 'span',
  className = '',
  delay = 0,
  stagger = 0.025,
  trigger = 'inview',
}: Props) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const chars = el.querySelectorAll<HTMLElement>('.st-char')

    if (prefersReducedMotion()) {
      gsap.set(chars, { yPercent: 0, opacity: 1 })
      return
    }

    gsap.set(chars, { yPercent: 115, opacity: 0 })
    const animate = () =>
      gsap.to(chars, {
        yPercent: 0,
        opacity: 1,
        duration: 0.9,
        ease: 'power4.out',
        stagger,
        delay,
      })

    if (trigger === 'mount') {
      const t = gsap.delayedCall(0.05, animate)
      return () => t.kill()
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          animate()
          io.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [text, delay, stagger, trigger])

  const words = text.split(' ')

  return (
    <Tag ref={ref} className={className} aria-label={text}>
      {words.map((word, wi) => (
        <span
          key={wi}
          aria-hidden
          className="inline-block overflow-hidden align-bottom"
          style={{ paddingBottom: '0.08em' }}
        >
          {Array.from(word).map((ch, ci) => (
            <span key={ci} className="st-char inline-block will-change-transform">
              {ch}
            </span>
          ))}
          {wi < words.length - 1 && <span className="st-char inline-block">&nbsp;</span>}
        </span>
      ))}
    </Tag>
  )
}
