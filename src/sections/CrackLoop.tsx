'use client'

import Reveal from '../components/Reveal'
import TiltCard from '../components/TiltCard'
import Magnetic from '../components/Magnetic'

const FEATURES = [
  'Algorithms & data structures, from patterns to mastery',
  'System design with real architecture trade-offs',
  'CS foundations: OS, networks, databases, concurrency',
  'Engineering craft: testing, debugging, clean code',
  'Modern & specialized: ML, distributed systems, security',
]

const TOPICS = [
  { t: 'Algorithms & DS', n: '480+ problems', c: 'from-aurora-violet/30' },
  { t: 'System Design', n: '60 case studies', c: 'from-aurora-indigo/30' },
  { t: 'CS Foundations', n: '8 core tracks', c: 'from-aurora-cyan/30' },
  { t: 'Engineering Craft', n: '120 drills', c: 'from-aurora-blue/30' },
  { t: 'Modern Topics', n: 'ML · Security · DS', c: 'from-aurora-magenta/30' },
  { t: 'Behavioral', n: 'STAR story builder', c: 'from-aurora-pink/30' },
]

function PhoneMock() {
  const rows = [
    { label: 'Arrays & Hashing', pct: 92 },
    { label: 'Graphs', pct: 64 },
    { label: 'System Design', pct: 38 },
  ]
  return (
    <div className="relative mx-auto aspect-[9/18] w-[260px] rounded-[2.6rem] border border-white/15 bg-ink2/80 p-3 shadow-2xl sm:w-[280px]">
      <div className="absolute left-1/2 top-3 h-1.5 w-16 -translate-x-1/2 rounded-full bg-white/20" />
      <div className="flex h-full flex-col gap-4 overflow-hidden rounded-[2rem] bg-gradient-to-b from-white/[0.06] to-transparent p-5 pt-8">
        <div className="flex items-center justify-between">
          <span className="font-display text-sm font-semibold text-white">CrackLoop</span>
          <span className="rounded-full bg-aurora-violet/20 px-2 py-0.5 text-[10px] font-semibold text-aurora-cyan">
            🔥 14-day loop
          </span>
        </div>

        <div className="rounded-2xl bg-white/5 p-4">
          <p className="text-[11px] uppercase tracking-widest text-white/40">Today’s loop</p>
          <p className="mt-1 font-display text-lg font-semibold text-white">Sliding Window</p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-aurora-violet to-aurora-cyan" />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="flex justify-between text-[11px] text-white/60">
                <span>{r.label}</span>
                <span>{r.pct}%</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-aurora-cyan to-aurora-magenta"
                  style={{ width: `${r.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto rounded-xl bg-white py-2.5 text-center text-sm font-semibold text-ink">
          Continue loop
        </div>
      </div>
    </div>
  )
}

export default function CrackLoop() {
  return (
    <section id="crackloop" className="relative py-28 sm:py-36">
      <div className="shell">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div>
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-aurora-cyan">
                Flagship · Live
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="mt-5 font-display text-[clamp(2rem,5vw,3.6rem)] font-semibold">
                Meet <span className="text-aurora">CrackLoop</span>
              </h2>
            </Reveal>
            <Reveal delay={140}>
              <p className="mt-5 max-w-xl text-lg text-white/60">
                Interview prep that runs on loops, not cram sessions. Adaptive practice across the
                full stack of software engineering — so progress compounds every single day.
              </p>
            </Reveal>

            <ul className="mt-8 flex flex-col gap-3">
              {FEATURES.map((f, i) => (
                <Reveal as="li" key={f} delay={i * 70}>
                  <div className="flex items-start gap-3">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-aurora-violet/20 text-[11px] text-aurora-cyan">
                      ✓
                    </span>
                    <span className="text-white/75">{f}</span>
                  </div>
                </Reveal>
              ))}
            </ul>

            <Reveal delay={120}>
              <div className="mt-9">
                <Magnetic>
                  <a
                    href="mailto:impactloopapps@gmail.com?subject=CrackLoop%20early%20access"
                    data-cursor
                    className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-semibold text-ink transition-transform hover:scale-[1.03]"
                  >
                    Get early access →
                  </a>
                </Magnetic>
              </div>
            </Reveal>
          </div>

          <Reveal delay={120} className="flex justify-center">
            <TiltCard className="rounded-[2.6rem]" max={7}>
              <PhoneMock />
            </TiltCard>
          </Reveal>
        </div>

        {/* Topic rail — swipeable on touch, trackpad/drag on desktop */}
        <div className="mt-20">
          <Reveal>
            <h3 className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-white/40">
              What you’ll loop through
            </h3>
          </Reveal>
          <div className="relative">
            <div className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TOPICS.map((topic) => (
                <article
                  key={topic.t}
                  className={`group relative w-[78vw] shrink-0 snap-start overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${topic.c} to-transparent p-7 sm:w-[340px]`}
                >
                  <div className="glass absolute inset-0 -z-10 rounded-3xl" />
                  <span className="font-display text-3xl font-semibold text-white/90">
                    {topic.t}
                  </span>
                  <p className="mt-2 text-white/55">{topic.n}</p>
                  <div className="mt-10 flex items-center gap-2 text-sm text-aurora-cyan">
                    Start track
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
