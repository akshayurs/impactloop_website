# Handover — Impact Loop rewrite (2026-07-15)

Branch: `feat/rewrite-v3` (pushed to `akshayurs/impactloop_website`). All 4 plans implemented. 182/182 tests, typecheck + build green.

## What exists
- **Plan 1** Foundation: Next 15/React 19/Tailwind 4, light+dark, static marketing pages (home, /apps/[appId], /pricing, legal, sitemap/robots/404), Google auth, mobile-first, a11y. Reviewed ✅ (opus).
- **Plan 2** Billing: Firestore plans + seed script, Razorpay checkout (subscriptions + lifetime orders), HMAC/idempotent webhook → entitlements, cancel, payment history, public `GET /api/v1/plans`. Reviewed ✅ (opus, e2e traced).
- **Plan 3** Admin: `admin` custom claim (`scripts/set-admin.mjs <email>`), /admin dashboard (metrics, users+trial-grant/revoke, plan CRUD, settings, webhook log), user free trials. Reviewed ✅ (opus).
- **Plan 4** Influencer: apply→approve→rates, promo codes (lifetime = price cut; recurring = free days via start_at — see design note in plan doc), referral links `?ref=CODE`, commissions on webhook-verified payments, /influencer portal, /admin/influencers, manual payouts. Tests pass but **NO final code review — see Pending #1**.

Docs: specs + plans in `docs/superpowers/`; ledger `.superpowers/sdd/progress.md`; audit `docs/AUDIT-2026-07-14.md`.

## Pending (in order)

1. **Plan 4 review (skipped for token budget).** Dispatch one opus reviewer over `git diff ee56869..5ac7355` (package exists: `.superpowers/sdd/review-ee56869..5ac7355.diff`). Focus: self-referral blocks, commission idempotency (`referrals/pay-{paymentId}`), server-side discount math, payout≤balance, seam `promoCode/promoOwnerUid` fields between checkout(writer)/webhook+verify(readers), auth on influencer/admin routes. Fix Critical/Important with one haiku fixer, re-run `pnpm test && pnpm typecheck && pnpm build`, commit.
2. **Browser pass of new UI** (preview_start `website-dev`): /influencer (signed-out gate), /admin/influencers tab, promo input on /pricing, account influencer card. Fix visual/console issues only.
3. **Push** any new commits: `git push origin feat/rewrite-v3`.
4. **USER manual gates** (need human + real creds — do not automate):
   - `.env.local`: 4 `NEXT_PUBLIC_FIREBASE_*` + `FIREBASE_SERVICE_ACCOUNT` + 3 `RAZORPAY_*` (test keys)
   - Firebase: authorized domains (localhost + Vercel), deploy `firestore.rules`, create composite index plans(appId ASC, active ASC, sort ASC) — console link prints in server logs
   - `node --env-file=.env.local scripts/seed-plans.mjs` then `scripts/set-admin.mjs <owner-email>` (re-sign-in after)
   - Razorpay dashboard: webhook → `https://<domain>/api/razorpay/webhook`, events subscription.* + order.paid, secret = RAZORPAY_WEBHOOK_SECRET
   - Walk `docs/BILLING-TEST-GATE.md` (billing rows, admin rows A1-A7, influencer rows I1-I9) in Razorpay TEST mode
5. **Launch**: real CrackLoop screenshots (placeholders in /apps/crackloop), real plan prices via /admin/plans, set `NEXT_PUBLIC_SITE_URL`, Vercel domain cutover, then merge feat/rewrite-v3 → main.

## How to work this repo (for next agent)
- Plans are self-contained with verbatim code; use subagent-driven-development skill; haiku for transcription, sonnet for money code, opus only for final reviews.
- Test gotchas: vi.hoisted() for mock consts in vi.mock factories; NEVER `beforeEach(mockReset)` with rejected-promise mocks (phantom unhandled-rejection — see ~/.claude/findings/vitest-mockreset-unhandled-rejection.md); `.then(()=>null,e=>e)` for rejection asserts; afterEach(cleanup) in component tests.
- Don't run `pnpm build` while dev server runs (corrupts .next → phantom 500s; rm -rf .next + restart).
- Known deferred minors: ledger "Minors" lines in `.superpowers/sdd/progress.md`; grant-trial UI hardcodes crackloop (single-app); recurring promo = free days not literal price cut (Razorpay Offers not automatable — `offerId` seam reserved).
