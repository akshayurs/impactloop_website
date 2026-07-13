'use client'

import { CSSProperties, ElementType, ReactNode } from 'react'
import { useInView } from '../lib/useInView'

interface Props {
  children: ReactNode
  className?: string
  delay?: number
  as?: ElementType
}

// Fade + rise on scroll-in. Respects reduced motion via CSS (see index.css).
export default function Reveal({ children, className = '', delay = 0, as: Tag = 'div' }: Props) {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <Tag
      ref={ref}
      className={`reveal ${inView ? 'is-visible' : ''} ${className}`}
      style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  )
}
