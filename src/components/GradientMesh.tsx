'use client'

// Fixed aurora mesh behind all content. Static blobs (no per-frame animation) so the
// glass `backdrop-filter` layers aren't forced to resample a moving background.
export default function GradientMesh() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink">
      <div className="absolute left-[-15%] top-[-12%] h-[55vmax] w-[55vmax] rounded-full bg-aurora-violet/30 blur-[80px]" />
      <div className="absolute right-[-18%] top-[8%] h-[48vmax] w-[48vmax] rounded-full bg-aurora-cyan/25 blur-[80px]" />
      <div className="absolute bottom-[-20%] left-[20%] h-[50vmax] w-[50vmax] rounded-full bg-aurora-magenta/20 blur-[90px]" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,transparent_40%,#05060a_100%)]" />
    </div>
  )
}
