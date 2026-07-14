'use client'
import { useId } from 'react'

type Props = { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>

export function Input({ label, error, className = '', ...rest }: Props) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        className={`h-10 rounded-lg border border-line bg-card px-3 text-sm text-fg placeholder:text-muted ${className}`}
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
