export function Logo() {
  return (
    <span className="flex items-center gap-2 font-display text-lg font-bold text-fg">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="var(--accent)" strokeWidth="3" />
        <circle cx="12" cy="3" r="3" fill="var(--accent)" />
      </svg>
      Impact Loop
    </span>
  )
}
