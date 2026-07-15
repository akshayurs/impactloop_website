'use client'
import { useId } from 'react'

type Props = { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>

export function Input({ label, error, className = '', ...rest }: Props) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-mono text-xs uppercase tracking-[0.1em] text-muted">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        className={`h-10 rounded-lg border border-line bg-card px-3 text-sm text-fg placeholder:text-muted transition-colors focus:border-2 focus:border-accent focus:outline-none ${className}`}
        {...rest}
      />
      {error ? (
        <p role="alert" className="text-xs text-red-500">
          {error}
        </p>
      ) : null}
    </div>
  )
}
