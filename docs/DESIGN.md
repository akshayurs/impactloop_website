# Impact Loop design system

One place to change the look of the whole site. Read this before styling anything.

## Where things live

| What | File |
| --- | --- |
| Colors, fonts, shadows (light+dark) | `src/app/globals.css` — CSS variables in `:root` / `.dark`, mapped to Tailwind via `@theme inline` |
| Motion & motif utilities | `src/app/globals.css` — `.kicker`, `.loop-underline`, `.loop-ring`, `.orbit`, `.hero-spot`, `.dot-grid`, `.reveal`, `.fade-up*`, `.marquee`, `.card-lift`, `.skeleton` |
| Primitives | `src/components/ui/` — `Button`, `Card`, `Badge`, `Input`, `Table`, `ConfirmModal`, `Section` |
| Fonts | `src/app/layout.tsx` — Space Grotesk (display), Inter (sans), JetBrains Mono (mono) |
| App registry (name, copy, features, screenshots, topics) | `src/config/apps.ts` |
| Static plan fallback | `src/config/plans.ts` |

To re-theme the entire site, edit the CSS variables in `globals.css` only.

## Language: editorial brutalist + loop motif

- **Palette**: paper background, ink text, one ember-orange accent. Accent is for emphasis
  only — never large fills except primary buttons and selected pills.
- **Type**: `font-display` for headings, `font-mono` (uppercase, `tracking-[0.18em]`) for
  labels/microcopy, `font-sans` for body.
- **Section pattern** (see `Section`/`SectionHeader` in `ui/section.tsx`):
  kicker row with number (`01 — Label`) over a `border-b-2 border-line-strong`, then an
  oversized `font-display` heading, then content.
- **Borders**: structural borders are `border-2 border-line-strong` (ink). Soft dividers are
  `border-line`. Grid-of-cells: wrapper `rounded-2xl border-2 border-line-strong bg-line-strong`
  with `gap-px` children `bg-card` (hairline grid).
- **Loop motif**: `.loop-ring` decorations, `.kicker` (has a built-in ring dot),
  `.loop-underline` on ONE word per hero. Don't overuse.
- **Cards**: `Card` primitive; add `interactive` for the hard-offset hover (`.card-lift`).
- **Stats**: mono uppercase label + `font-display` bold number.
- **Lists**: `↳` accent marker (see pricing benefits).
- **Motion**: CSS only. `.fade-up` (+`-1/-2/-3`) for heroes, `.reveal` for scroll-in cells,
  `.orbit` rings behind heroes, `.marquee` for strips. Everything respects
  `prefers-reduced-motion` globally.
- **Empty/loading states**: `.skeleton` blocks while loading; friendly one-liner + action
  when empty. Never a bare "Loading…" string on styled pages.

## Rules

- Never hardcode hex colors in components — use token classes (`text-fg`, `bg-card`,
  `border-line`, `text-accent`, …).
- No purple. No generic "AI-generated SaaS" look.
- Fake/unverified copy must carry a `PLACEHOLDER` code comment.
- Admin pages: same tokens, denser spacing, no marketing flourishes (no orbits/marquees).
