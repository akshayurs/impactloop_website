export default function Loading() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-6xl flex-col items-center justify-center px-4 sm:px-6" aria-busy="true">
      <div aria-hidden className="loop-ring h-12 w-12" />
      <p className="mt-6 font-mono text-xs uppercase tracking-[0.2em] text-muted" role="status">
        Loading…
      </p>
    </div>
  )
}
