'use client'
import { useEffect } from 'react'
import { Button } from './button'

type Props = {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
  destructive?: boolean
}

export function ConfirmModal({ open, title, body, confirmLabel, onConfirm, onClose, destructive }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative w-full max-w-sm rounded-2xl border border-line bg-card p-6">
        <h2 className="font-display text-lg font-semibold text-fg">{title}</h2>
        <p className="mt-2 text-sm text-muted">{body}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Keep
          </Button>
          <Button
            onClick={onConfirm}
            className={destructive ? 'bg-red-600 text-white hover:opacity-90' : ''}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
