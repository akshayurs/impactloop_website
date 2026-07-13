'use client'

import { useEffect, useRef } from 'react'

// Custom dot + trailing ring cursor. Desktop / fine-pointer only; uses mix-blend so
// it stays visible over any background. Falls back to the native cursor on touch.
export default function Cursor() {
  const dot = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    document.body.classList.add('hide-cursor')

    let mx = window.innerWidth / 2
    let my = window.innerHeight / 2
    let rx = mx
    let ry = my
    let hovering = false
    let raf = 0

    const onMove = (e: PointerEvent) => {
      mx = e.clientX
      my = e.clientY
      if (dot.current) dot.current.style.transform = `translate3d(${mx}px, ${my}px, 0)`
      const t = e.target as HTMLElement | null
      hovering = !!t?.closest('a, button, [data-cursor]')
    }

    const loop = () => {
      rx += (mx - rx) * 0.18
      ry += (my - ry) * 0.18
      if (ring.current) {
        ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0) scale(${hovering ? 1.9 : 1})`
        ring.current.style.opacity = hovering ? '1' : '0.55'
      }
      raf = requestAnimationFrame(loop)
    }

    window.addEventListener('pointermove', onMove)
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      document.body.classList.remove('hide-cursor')
    }
  }, [])

  return (
    <>
      <div
        ref={ring}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[70] -ml-4 -mt-4 h-8 w-8 rounded-full border border-white/70 mix-blend-difference will-change-transform"
      />
      <div
        ref={dot}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[70] -ml-1 -mt-1 h-2 w-2 rounded-full bg-white mix-blend-difference will-change-transform"
      />
    </>
  )
}
