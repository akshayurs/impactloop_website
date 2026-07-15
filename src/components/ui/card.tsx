export function Card({
  children,
  className = '',
  interactive = false,
}: {
  children: React.ReactNode
  className?: string
  interactive?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border border-line bg-card p-6 shadow-(--shadow-card) ${interactive ? 'card-lift' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
