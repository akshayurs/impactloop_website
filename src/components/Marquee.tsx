'use client'

import { CSSProperties } from 'react'

interface Props {
  items: string[]
  reverse?: boolean
  duration?: number
  className?: string
}

// Seamless infinite marquee: the track holds two copies of the items, so a -50%
// translate loops perfectly.
export default function Marquee({ items, reverse = false, duration = 30, className = '' }: Props) {
  const set = (key: string) => (
    <ul key={key} className="flex shrink-0 items-center" aria-hidden={key === 'b'}>
      {items.map((item, i) => (
        <li key={i} className="flex items-center whitespace-nowrap">
          <span className="font-display text-2xl font-medium text-white/80 sm:text-3xl">{item}</span>
          <span className="mx-6 text-aurora sm:mx-9" aria-hidden>
            ✦
          </span>
        </li>
      ))}
    </ul>
  )

  return (
    <div className={`relative flex overflow-hidden ${className}`}>
      <div
        className="animate-marquee flex min-w-max"
        style={
          {
            '--marquee-duration': `${duration}s`,
            animationDirection: reverse ? 'reverse' : 'normal',
          } as CSSProperties
        }
      >
        {set('a')}
        {set('b')}
      </div>
    </div>
  )
}
