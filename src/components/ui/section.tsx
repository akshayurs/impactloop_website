/* Editorial section scaffolding — see docs/DESIGN.md. */

export function SectionHeader({
  kicker,
  title,
  aside,
  id,
  soft = false,
}: {
  kicker: string
  title?: string
  aside?: string
  id?: string
  soft?: boolean
}) {
  return (
    <>
      <div
        className={`flex items-baseline justify-between pb-4 ${
          soft ? 'border-b border-line' : 'border-b-2 border-line-strong'
        }`}
      >
        <p className="kicker" id={title ? undefined : id}>
          {kicker}
        </p>
        {aside ? (
          <p className="hidden font-mono text-xs uppercase tracking-[0.18em] text-muted sm:block">{aside}</p>
        ) : null}
      </div>
      {title ? (
        <h2 id={id} className="mt-8 max-w-2xl font-display text-4xl font-bold text-fg">
          {title}
        </h2>
      ) : null}
    </>
  )
}

/* Hairline grid of cells: wrapper paints the lines, children paint bg-card. */
export function CellGrid({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`grid gap-px overflow-hidden rounded-2xl border-2 border-line-strong bg-line-strong ${className}`}>
      {children}
    </div>
  )
}

export function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border-2 p-5 ${highlight ? 'border-accent bg-accent-soft' : 'border-line-strong bg-card'}`}>
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold text-fg">{value}</p>
    </div>
  )
}
