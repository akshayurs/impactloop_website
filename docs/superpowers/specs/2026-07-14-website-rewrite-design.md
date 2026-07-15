# Impact Loop — Full Website Rewrite Design

Date: 2026-07-14
Status: approved in brainstorming; pending final user review
Prior audit: docs/AUDIT-2026-07-14.md

## Decision summary

Full greenfield rewrite (approach B). Old code is reference only — nothing carried over, because the previous site was AI-generated and never verified end-to-end (billing included). New code is written and tested fresh; Razorpay flows verified in test mode before launch.

Key user decisions:
- Kill all 3D/heavy animation (three.js, GSAP, Lenis, custom cursor) — it made the site slow
- Light + dark clean SaaS theme, professional, mobile-first
- Multi-app studio site (CrackLoop live on Play Store now; more apps coming) — nothing hardcoded to one app
- No waitlist feature (previous AI artifact) — remove fake stats, dead links
- Three roles: admin (exactly one), influencer, user
- Google sign-in only
- Manual commission payouts (admin pays via UPI/bank, marks paid in dashboard)
- Promo discount applies to first billing cycle only
- Plans fully data-driven, admin-managed; Android app consumes plans via public API

## 1. Stack & architecture

- Next.js 15 (App Router) + React 19 + TypeScript, deployed on Vercel
- Server-first: marketing pages static/SSG; client JS only for interactive islands (checkout, dashboards)
- Animations: CSS + IntersectionObserver only. No WebGL, no animation libs
- Firebase: Auth (Google provider only), Firestore, Admin SDK in API routes
- Roles via Firebase custom claims (`role: 'admin' | 'influencer' | 'user'`), enforced server-side on every privileged API route. Exactly one admin (set via one-time script on the owner's Google account)
- Razorpay: subscriptions for recurring plans, one-time orders for lifetime Pro
- Tailwind v4 + small design system: Button, Card, Input, Badge, Modal, Table primitives — single source of truth
- Same repo, fresh `src/`; new branch; old code deleted at cutover

## 2. Pages & routes

### Public (static, fast)
| Route | Purpose |
|---|---|
| `/` | Studio home: CSS-animated hero, apps grid, web-vs-Play-Store price advantage banner, how-it-works, CTA |
| `/apps/[appId]` | App detail (CrackLoop first): screenshots (placeholder slots — real images added later), features, Play Store button (`https://play.google.com/store/apps/details?id=com.impactloop.crackloop`), pricing CTA |
| `/pricing` | Plans from Firestore: durations 1/3/6/12 months per tier + lifetime Pro; pre-applied web discount shown as strikethrough vs Play Store price; promo-code input |
| `/terms`, `/privacy` | Real routes inside the app shell |

### User (signed in)
| Route | Purpose |
|---|---|
| `/account` | Per-app subscriptions, payment history, cancel, request free trial (if admin-enabled), apply to become influencer |

### Influencer
| Route | Purpose |
|---|---|
| `/influencer` | Application status; when approved: promo-code manager (suggested options, change any time to an unused code, old code deleted), earnings dashboard (signups, conversions, balance, payout history) |

### Admin (single admin)
| Route | Purpose |
|---|---|
| `/admin` | Overview: revenue, active subs, signups, conversion metrics |
| `/admin/users` | Search/view/edit any user, grant free trial (7 days / month / custom), manage subscription, support actions |
| `/admin/influencers` | Approve/reject applications (social links shown), set per-influencer commission: signup amount + per-plan subscription amounts, mark payouts paid |
| `/admin/plans` | Plan CRUD (app, tier, duration, price, web discount, active) |
| `/admin/promos` | All promo codes, default-expiry config (default 3 months), performance stats |
| `/admin/settings` | Free-trial toggle + duration, promo expiry default, global config |
| `/admin/webhooks` | Webhook event log for debugging |

### API
- Auth'd: checkout (subscription create / lifetime order), cancel, trial request, promo validate/apply, influencer application, promo-code change
- Admin: all dashboard mutations (role-checked via custom claim)
- Webhook: `POST /api/razorpay/webhook` — HMAC-verified, idempotent
- Public for Android app: `GET /api/v1/plans` (available plans per app); app-side promo validation endpoint if feasible (app discounts are separate from web promo codes)

Every page shares nav + footer. No dead-end pages.

## 3. Data model (Firestore)

| Collection | Contents |
|---|---|
| `users/{uid}` | profile, role mirror, `referredBy` code, createdAt |
| `users/{uid}/apps/{appId}` | subscription {status, planId, expiryTimeMillis, autoRenewing} + entitlements — the doc the Android app's backend contract is based on |
| `plans/{planId}` | appId, tier (pro/ai), durationMonths (1/3/6/12) or `lifetime: true`, pricePaise, razorpayPlanId (null for lifetime), playStorePricePaise (for strikethrough), webDiscountPct, active, sort |
| `influencers/{uid}` | application {socialLinks[], submittedAt, status: pending/approved/rejected}, commissionRates {signupPaise, perPlan {planId → paise}}, totals |
| `promoCodes/{code}` | ownerUid, discountPct, createdAt, expiresAt (default +3 months, admin-configurable), active |
| `referrals/{id}` | code, referredUid, type: signup/subscription, planId?, commissionPaise, createdAt |
| `payouts/{id}` | influencerUid, amountPaise, note, paidAt |
| `orders/{orderId}` | lifetime purchases: razorpayOrderId, uid, planId, status |
| `razorpaySubscriptions/{subId}` | {uid, appId, planId} index for webhook resolution |
| `webhookEvents/{id}` | idempotency marker + payload summary for admin log |
| `settings/global` | freeTrialEnabled, trialDays, promoDefaultExpiryMonths, defaults |

### Attribution mechanics
- Referral link `?ref=CODE` → cookie → attached to `users/{uid}.referredBy` at first sign-in → signup commission referral recorded
- Promo code at checkout → buyer gets `discountPct` off first cycle → subscription commission recorded only when webhook confirms payment
- Influencer balance = Σ referral commissions − Σ payouts (computed, never stored — no drift)
- Free trial: admin-enabled toggle; user requests → instant grant, once per user per app; admin can revoke

## 4. Billing flows (Razorpay)

- **Recurring:** admin creates plan → server creates Razorpay Plan and stores id → checkout creates Subscription → Razorpay modal → webhook `subscription.activated`/`charged` grants entitlement; `halted`/`cancelled`/`completed` revokes at expiry end
- **Promo first-cycle discount:** Razorpay Offer attached at subscription create (`offer_id`). Fallback if programmatic offers are unreliable in test mode: first cycle as a discounted one-time order + subscription with `start_at` = cycle 2. Choice made during implementation with test-mode evidence
- **Lifetime Pro:** one-time Razorpay Order → payment signature verified server-side → permanent entitlement (`expiryTimeMillis: null`)
- **Web pre-applied discount:** Razorpay plan price is the already-discounted amount; `playStorePricePaise` is display-only strikethrough. No runtime arithmetic on charged amounts
- **Commissions:** recorded only on webhook-confirmed payment or verified signup — never from client claims
- All amounts integer paise. All money paths server-side. HMAC + idempotency on webhook

## 5. Theme & UX

- Clean SaaS aesthetic: near-white light theme + true dark theme, system default with toggle; single violet brand accent (continuity with existing logo) used sparingly
- `next/font` self-hosted: Inter (body), Space Grotesk (display)
- Mobile-first: thumb-reachable primary actions, safe-area padding, admin tables collapse to cards on small screens
- Accessibility: WCAG AA contrast, skip-to-content link, visible focus states, semantic HTML, no custom cursor
- Performance budget: LCP < 1.5s on marketing pages; near-zero client JS on static pages
- Destructive actions (cancel subscription, delete promo, reject application) require confirm dialogs

## 6. Testing & rollout

- **Unit (Vitest):** money math, commission calculation, promo validation/expiry, webhook event mapping, entitlement grant/revoke
- **Integration:** API routes against Firebase emulators; role-enforcement matrix (user/influencer/admin × every privileged route)
- **E2E billing in Razorpay test mode with evidence:** checkout → webhook → Firestore entitlement → `/account` display → cancel → revoke. Repeat for lifetime order, promo discount, commission recording
- **Firestore security rules:** default-deny; clients read own docs only; all writes server-side. Rules covered by emulator tests
- **Rollout:** new branch → Vercel preview → user verification → one-time script sets `admin` claim on owner account → domain cutover. GitHub Pages site stays live until cutover

## Out of scope (this project)
- Automated payouts (Razorpay Payouts/KYC) — manual only
- Email/password or Apple auth — Google only
- App-side (Play Store) promo codes — separate future work; only the public plans API contract is provided
- i18n, PWA, blog
