'use client'

interface Props {
  className?: string
  showText?: boolean
}

export default function Logo({ className = '', showText = true }: Props) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg width="30" height="30" viewBox="0 0 64 64" fill="none" aria-hidden>
        <defs>
          <linearGradient id="loopGrad" x1="12" y1="22" x2="52" y2="42" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7C5CFF" />
            <stop offset="0.5" stopColor="#22D3EE" />
            <stop offset="1" stopColor="#E879F9" />
          </linearGradient>
        </defs>
        <path
          d="M32 32 C 26 21, 13 21, 13 32 C 13 43, 26 43, 32 32 C 38 21, 51 21, 51 32 C 51 43, 38 43, 32 32 Z"
          stroke="url(#loopGrad)"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      {showText && (
        <span className="font-display text-lg font-semibold tracking-tight text-white">
          Impact <span className="text-aurora">Loop</span>
        </span>
      )}
    </span>
  )
}
