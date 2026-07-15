# Impact Loop — Growth Roadmap (pre-production)

Goal: 10k–100k users and ~1,000 influencers within ~1 year of launch. This doc inventories
what the site already has, gaps against that goal, and a phased improvement plan across
product, growth, influencer program, admin/ops, and polish.

Written 2026-07-15, against `main` (post `feat/rewrite-v3` merge). See
`docs/HANDOVER.md` for the pre-launch pending list — everything there blocks this doc.

**Owner constraints (2026-07-15):** solo dev + AI agents (permanent); Google-only auth is
fine; international payments deferred — show "coming soon", enable after Razorpay India
business is proven; single admin is fine; **top priority is a beautiful UI.**

---

## 1. Current feature inventory

### Public / marketing
- Static marketing pages: home, `/apps/[appId]` (CrackLoop), `/pricing`, `/terms`, `/privacy`,
  sitemap, robots, 404. Server components, light+dark themes, mobile-first, a11y,
  `prefers-reduced-motion` respected.
- Public plans API: `GET /api/v1/plans`.

### Users
- Google sign-in (Firebase Auth) gating `/account`.
- Razorpay checkout: subscriptions + lifetime orders; HMAC-verified idempotent webhook →
  entitlements; cancel flow; payment history.
- Free trials: admin-configurable, once per user per app.
- Promo code input at checkout (lifetime = price cut; recurring = free days via `start_at`).
- Referral attribution via `?ref=CODE` links.

### Influencers
- Apply → admin approve → per-influencer commission rates.
- Promo codes + referral links; commissions computed on webhook-verified payments
  (idempotent per payment).
- `/influencer` portal: earnings, code, link.
- Manual payouts (atomic, payout ≤ balance).

### Admin
- Single admin via Firebase custom claim (`scripts/set-admin.mjs`).
- `/admin`: metrics dashboard, user management (trial grant/revoke), plan CRUD, settings,
  webhook log, `/admin/influencers` (applications, rates, payouts).

### Engineering
- Next 15 / React 19 / Tailwind 4 / TypeScript, Vitest (182 tests), Vercel deploy,
  Firestore rules, seed scripts.

---

## 2. Gap analysis vs. 100k users / 1k influencers

| Area | Gap | Why it matters at scale |
| --- | --- | --- |
| UI polish | Functional but not "wow" | Owner's #1 priority — first impression drives signup + influencer willingness to promote |
| Analytics | None | Can't measure funnel, attribution, or influencer ROI — flying blind |
| SEO/content | Static pages only, no blog/changelog | Organic is the cheapest channel to 100k; no content = no compounding traffic |
| Email | None (no transactional or lifecycle email) | No receipts, trial-expiry nudges, win-back, influencer notifications |
| Payments | Razorpay only (INR-centric) | Deferred by design — show "International payments coming soon" on pricing; revisit after India revenue |
| Referrals | Influencer-only | No user→user referral loop = missing the strongest viral mechanic |
| Influencer self-serve | Manual approve + manual payouts | 1k influencers × manual ops kills a solo dev; needs automation + tiers |
| Support | None | 10k+ users generate support volume; need at least FAQ + contact email |
| Observability | Webhook log only | Need error tracking (Sentry), uptime, payment-failure alerting — solo dev needs alerts, not dashboards |

Out of scope by owner decision: extra auth providers (Google-only stays), admin
roles/audit (single admin stays), localization (revisit only if data demands).

---

## 3. Phased plan

### Phase 0 — Launch blockers (now, ~1 week)
Everything in `docs/HANDOVER.md` Pending list:
1. Plan 4 (influencer) final code review + fixes.
2. Browser pass of new UI.
3. Manual gates: env vars, Firebase domains/rules/index, seed, Razorpay webhook,
   `docs/BILLING-TEST-GATE.md` walkthrough in TEST mode.
4. Real screenshots, real prices, domain cutover, merge → deploy.

### Phase 1 — Beautiful UI + measurement (weeks 1–4)
UI is the owner's #1 priority — do the full §4 polish pass here, before/alongside launch.
- **UI overhaul**: everything in §4 below.
- **"International payments coming soon"** note on `/pricing` (and checkout error path for
  non-INR cards if Razorpay surfaces it).
- **Analytics**: PostHog or Plausible + server-side events for checkout steps
  (view pricing → open checkout → payment success). UTM capture stored alongside `?ref`.
- **Error tracking**: Sentry (client + server).
- **Transactional email** (Resend/Postmark): payment receipt, trial started/expiring,
  subscription canceled, influencer application received/approved, payout sent.
- **Basic support surface**: `/faq`, contact email, refund policy page.

### Phase 2 — Growth loops (months 2–4)
- **User referral program**: give-get (e.g. both sides get free days). Reuses the existing
  referral/commission plumbing — biggest leverage from code you already have.
- **Content engine**: blog + changelog (MDX in-repo is fine), per-app SEO landing pages
  targeting problem keywords, comparison pages. OG images per page.
- **Onboarding funnel**: post-signup email sequence; in-account "getting started" checklist.
- **Social proof**: testimonials, user counts, ratings on home + pricing.
- **Pricing experiments**: annual plan (better LTV), money-back badge.
- International payments stay "coming soon" until India business is proven; then apply
  for Razorpay international (no Stripe migration planned).

### Phase 3 — Influencer program at scale (months 3–6) → 1k influencers
- **Self-serve onboarding**: public `/partners` landing page (commission %, examples of
  earnings, how it works), instant or auto-scored approval for small creators, manual
  review only above a follower threshold.
- **Influencer dashboard upgrades**: click→signup→purchase funnel per code, EPC,
  conversion rate, monthly statements, marketing asset kit (logos, screenshots, copy).
- **Tiers**: e.g. 20% base → 30% after N sales; time-limited launch bonuses.
- **Automated payouts**: RazorpayX payouts API (or manual batch UI) with KYC capture
  (PAN/GST for India, W-8/W-9 if international), minimum payout threshold, payout schedule.
- **Recruitment**: outreach lists in admin, deep links (`?ref=CODE` → specific app page),
  UTM-tagged assets, leaderboard (opt-in).
- **Fraud controls**: self-referral block (exists), plus velocity limits, refund clawbacks
  (deduct commission on refund/chargeback webhook), duplicate-device heuristics.

### Phase 4 — Scale ops, solo-dev style (months 6–12)
Principle: automate, don't delegate — there is no team.
- **Cohort + revenue analytics in /admin**: MRR, churn, LTV, trial→paid conversion,
  revenue per influencer.
- **Churn reduction**: cancel-flow survey + save offer (free days), dunning emails on
  failed renewals (Razorpay `subscription.halted` handling).
- **Alerting over dashboards**: payment-failure / webhook-error / error-rate alerts to
  email or Telegram so problems find the owner, not vice versa.
- **Uptime monitoring** (UptimeRobot-class, free tier).
- International payments application once India revenue is established.

---

## 4. Beautiful UI — the priority workstream

### Design direction
- Pick one strong visual identity and commit: distinctive accent color, generous
  whitespace, oversized display type (Space Grotesk already in), subtle grain/gradient
  backgrounds. Reference tier: Linear, Vercel, Resend marketing sites.
- Consistent design tokens in Tailwind 4 `@theme` (spacing scale, radii, shadows,
  semantic colors for light+dark) — one source of truth so agents can't drift.
- Keep the CSS-only animation constraint; well-crafted CSS transitions on hover/scroll
  (view-timeline where supported) read as premium without JS weight.

### Page-by-page pass
- **Home**: distinct hero, one-sentence value prop, single primary CTA, real product
  screenshot in a device frame, social proof strip, feature grid with icons, footer
  with sitemap links.
- **/apps/[appId]**: real screenshots + demo GIF/video, feature sections alternating
  layout, sticky "Get it" CTA on mobile.
- **/pricing**: plan comparison table, highlighted "most popular", FAQ accordion, trust
  badges (secure payment via Razorpay, cancel anytime), "International payments coming
  soon" note, promo-code field styled as first-class.
- **/account**: card-based layout, plan status hero, skeleton loaders, empty states
  with illustrations.
- **/influencer + /partners**: earnings hero number, stat cards, copy-link button with
  feedback, leaderboard-ready layout.
- **/admin**: functional polish only — density, tables, toasts; not customer-facing.

### Finish details
- OG/social card for every route (dynamic OG images via `next/og`).
- Favicon set + PWA manifest; consistent 404/empty/error states.
- Lighthouse ≥95 (perf/SEO/a11y) as a CI gate.
- Real content: no placeholder screenshots or lorem anywhere at launch.

## 5. Data & config completeness (users / influencers / admin)
- **Users**: profile (name, avatar from Google), plan + entitlement status, trial state,
  payment history, referral source, email prefs. Add: delete-account (GDPR/DPDP),
  data-export endpoint, notification preferences.
- **Influencers**: application data, rates, code, balance, payout history. Add: KYC fields,
  payout method details, tier, asset kit access, per-code stats, agreement acceptance
  timestamp + version.
- **Admin/settings**: plans, trials, rates, webhook log. Add: feature flags, promo campaign
  scheduling (start/end dates, max redemptions), announcement banner config, refund
  processing UI, audit log.

## 6. Suggested sequencing summary
1. Ship Phase 0 (blockers) — nothing else matters until live.
2. Instrument (analytics + email + Sentry) before spending on acquisition.
3. Build user referrals + content — cheapest compounding channels.
4. Scale influencer self-serve only after unit economics per influencer are visible.
5. Add ops/roles/automation when volume forces it, not before.
