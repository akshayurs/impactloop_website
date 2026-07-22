# Per-app partner program + company-level site — implementation plan

Status: **proposed, awaiting approval**. Build happens in phases; each phase ends green
(`pnpm typecheck` + `pnpm test`) and, where visible, is browser-verified via the mock server.

## Goal

Move the influencer/partner program from **one global identity per person** to **per-app
enrollment**, and reframe the marketing site around the **company (Impact Loop)** rather than
CrackLoop alone.

A partner should be able to:
- Join the program once (shared profile / social links).
- Enroll into specific apps individually — skip an app, or add one later.
- Have a **separate promo code per app**, whose share link opens **that app's page**.
- See earnings, referrals and payouts **per app**.

Admin should be able to:
- Set **pricing per app** (already exists) and a **default discount % per app**.
- Approve/reject each **app enrollment** separately.
- Set **commission rates per influencer per app**.
- Create a payout request and mark it paid, per app.

## Locked decisions (from review)

1. **Apply once, enroll per app.** One influencer identity; admin approves each app enrollment separately.
2. **App default discount + per-influencer per-app commission.** Discount % is an app-level setting; commission is set per influencer per app.
3. **Migrate existing global data → CrackLoop.** Current influencers / codes / referrals / payouts become the `crackloop` app's data.
4. **Plan first, build in phases**, review between phases.

## Payout granularity — DECIDED: aggregate

Payouts are **aggregate across all apps**. Balance = Σ all referral commission (any app) − Σ all
payouts. `payouts/{uid}-{ts}` and `payoutRequests/{uid}` stay **uid-keyed** (unchanged from today).
Referrals still carry `appId` so the portal can *show* a per-app earnings breakdown, but the
withdrawable balance and payout flow are one pool per partner.

---

## Current state (verified)

Already per-app: `plans` + `tiers` data model and stores (`where('appId','==',…)`), the pricing
page (renders a section per live app), footer product links, admin plan/tier CRUD (has an app
selector). `appId` is already written onto `orders/{id}`, `razorpaySubscriptions/{id}`, Razorpay
`notes`, `users/{uid}/apps/{appId}` entitlements, and `payments/*` — so it is available at every
commission call site.

Global (the layer we change):
- `influencers/{uid}` = `{ status, socialLinks, appliedAt, decidedAt, discountPct, commissionRates{signupPaise, perPlan}, promoCode }`
- `promoCodes/{code}` = `{ code, ownerUid, active, createdAt, expiresAt }` — **no appId**
- `referrals/{id}` = `{ code, ownerUid, referredUid, type, planId, commissionPaise, createdAt }` — **no appId**
- `payouts/{uid}-{ts}`, `payoutRequests/{uid}` — keyed by uid only
- `promo/validate?code=` — no appId, returns the influencer's single `discountPct`
- `referral/claim` — signup referral is app-less (`planId:null`)
- Homepage (`page.tsx`) hardcodes `APPS[0]` (CrackLoop); nav hardcodes `/apps/crackloop`; no `/apps` index; partners page copy is CrackLoop-specific.

---

## Target data model

### `influencers/{uid}` — shared identity (slimmed)
```
{ socialLinks: string[], appliedAt: number }
```
Program-level profile only. Per-app fields move out.

### `influencerApps/{uid}_{appId}` — per-app enrollment (NEW, core)
```
{
  uid: string,
  appId: string,
  status: 'pending' | 'approved' | 'rejected',
  appliedAt: number,
  decidedAt: number | null,
  promoCode: string | null,
  commissionRates: { signupPaise: number, perPlan: Record<planId, paise> }
}
```
Doc id `${uid}_${appId}` → direct lookup + uniqueness. Discount is NOT stored here (it's the app default).

### `partnerConfig/{appId}` — per-app partner settings (NEW)
```
{ discountPct: number, enabled: boolean }
```
Default `{ discountPct: 10, enabled: true }`. Admin-editable. `discountPct` is the discount every
approved code for that app grants at checkout.

### `promoCodes/{code}` — add `appId`
```
{ code, ownerUid, appId, active, createdAt, expiresAt }
```
Codes stay globally unique (doc id = code). A code is only valid for its own app.

### `referrals/{id}` — add `appId`
```
{ code, ownerUid, appId, referredUid, type, planId, commissionPaise, createdAt }
```
Enables per-app earnings aggregation.

### Payouts (aggregate — unchanged shape)
- `payouts/{uid}-{ts}` = `{ influencerUid, amountPaise, note, paidAt }` (as today)
- `payoutRequests/{uid}` = `{ influencerUid, amountPaise, status, requestedAt, upiId }` (as today)
- Balance = Σ all `referrals.commissionPaise` for `ownerUid` (any app) − Σ all `payouts.amountPaise`.
  `appId` on referrals is used only for the per-app earnings breakdown shown in the portal.

---

## Migration (runs in Phase 1)

Idempotent, admin-triggered route (`POST /api/admin/migrate-partners`, guarded by admin +
a confirm flag) plus a documented manual fallback:

- Each `influencers/{uid}` (status pending/approved/rejected) → create `influencerApps/{uid}_crackloop`
  with that `status`, `promoCode`, `commissionRates`; rewrite `influencers/{uid}` to `{ socialLinks, appliedAt }`.
- Each `promoCodes/{code}` → set `appId='crackloop'`.
- Each `referrals/{id}` → set `appId='crackloop'`.
- `payouts/{uid}-{ts}` → copy to `payouts/{uid}_crackloop_{ts}` (or add `appId='crackloop'` in place).
- `payoutRequests/{uid}` → `payoutRequests/{uid}_crackloop`.
- Create `partnerConfig/crackloop = { discountPct: 10, enabled: true }`.

Note: existing per-influencer `discountPct` values are dropped in favor of the app default (was 10 by
default anyway). Called out because it's the one lossy step.

---

## Phases

### Phase 1 — Data model, stores, migration, money path (server + APIs) — ✅ DONE
Leaves checkout/referral fully per-app; portal/admin still function (read crackloop via the new
functions). Shipped: `influencer-apps.ts`, `partner-config.ts`, `appId` on promo/referral,
migration route `POST /api/admin/migrate-partners`, all money-path routes rewired, legacy
endpoints scoped to `crackloop` (UI shapes unchanged), firestore indexes. 220 tests green.

- New `src/lib/server/influencer-apps.ts`: enrollment CRUD (`getEnrollment`, `listEnrollments(uid)`,
  `enroll`, `decideEnrollment`, `updateAppCommission`, `changeAppPromoCode`), per-app earnings
  (`getAppEarnings(uid, appId)`), per-app payout req/record. Reuse primitives from `promo.ts`.
- New `src/lib/server/partner-config.ts`: `getPartnerConfig(appId)` / `updatePartnerConfig` (cached, tag-invalidated).
- Extend `promoCodes`/`referrals` writes+reads with `appId`; `recordReferral` gains `appId`.
- `promo/validate`: accept `appId`, require `promo.appId===appId` **and** approved enrollment; return
  `discountPct` from `partnerConfig`.
- `referral/claim`: derive `appId` from the code doc; signup referral stored with that appId.
- `checkout` + `checkout/verify` + `razorpay/webhook`: discount from `partnerConfig[plan.appId]`;
  pass `appId` into `recordReferral`; commission from the enrollment's `commissionRates`.
- Migration route + tests. Update existing tests for new shapes.
- Verify: unit tests (money path), no visible UI change yet.

### Phase 2 — Admin (per-app) — ✅ DONE
Shipped: app selector (shown when >1 app), per-app enrollment list/approve/reject/commission/code
(all actions send `appId`), app default-discount + codes-enabled control wired to new
`/api/admin/partner-config`, plans filtered per app, per-influencer discount removed (now app-level).
Verified in browser via `website-dev-mock-admin`. 220 tests green.

### Phase 2 (original) — Admin (per-app)
- `admin/influencers`: list enrollments; filter by app; approve/reject per app; set commission per
  app; assign/change promo code per app; per-app earnings; create request / mark paid per app.
- Per-app **default discount** control (`partnerConfig`) — surfaced under Pricing or Influencers with an app selector.
- APIs: `admin/influencers` + `[uid]` actions become app-scoped (`appId` in body); new
  `admin/partner-config` endpoint.
- Payout-request email already built — now carries appId context.
- Verify: admin route tests; browser check via an admin mock (extend mock to stub the new admin endpoints).

### Phase 3 — Partner portal + account (per-app) — ✅ DONE
Shipped: `me` returns `{profile, apps[], availableApps[], earnings(aggregate), minPayoutPaise}`;
new `POST /api/influencer/enroll`; `apply` = identity only; `promo-code` takes `appId`. Portal
rewritten: aggregate earnings + payout, per-app cards (code + share link `/apps/{appId}?ref=CODE` +
per-app earned), enroll-more list, referrals table with App column. Account section = join / partner
status + portal link. Verified portal in browser. 222 tests green.

### Phase 3 (original) — Partner portal + account (per-app)
- Account page "Influencer program": join program (social links) once, then per-app enrollment cards
  (Enroll / Pending / Approved).
- `/influencer` portal: one section per app — promo code (app-scoped), **share link → `/apps/{appId}?ref=CODE`**,
  per-app earnings/referrals/payouts, request payout (with UPI). Non-enrolled live apps show an Enroll CTA.
- `influencer/me`: returns `{ profile, apps:[{appId,status,promoCode,discountPct,commission,earnings}], availableApps }`.
- Update the demo mock (`mock.ts`) to the per-app shape.
- Verify: browser-drive the portal via the influencer mock (enroll, code, share link, request payout).

### Phase 4 — Company-level site — ✅ DONE
Shipped: homepage rewritten company-level (studio hero, dynamic live apps + coming-soon slots,
generic method, "Explore the apps" → `/apps`); new `/apps` index page; nav `/apps` "Apps" link with
prefix active-state; partners page copy → per-app enrollment; app-page kicker de-hardcoded; sitemap
+ `/apps`. Verified homepage + `/apps` in browser. 222 tests green. **All four phases complete.**

### Phase 4 (original) — Company-level site
- Homepage: company hero (Impact Loop studio, multiple apps); "The apps" renders live `APPS`
  dynamically + coming-soon slots; de-CrackLoop the copy; generic method/pricing sections.
- New `/apps` index page (all apps, live + coming soon) from `APPS`.
- CrackLoop keeps its dedicated page via `/apps/[appId]` (already generic); optionally enrich.
- Nav: `/apps` (Apps) instead of hardcoded `/apps/crackloop`; footer already dynamic.
- Partners page: company-level copy; explain per-app enrollment.
- Verify: browser check homepage, `/apps`, `/apps/crackloop`, nav, responsive + dark.

---

## Risks / notes
- **Intermediate breakage:** Phase 1 changes shapes the portal/admin read. Mitigation — Phase 1
  keeps the portal/admin endpoints returning a working (crackloop-scoped) response until Phases 2–3
  fully switch them; each phase ends compiling + green.
- **Code uniqueness:** codes remain globally unique; a partner picks distinct codes per app.
- **Signup vs purchase commission:** both now read per-app enrollment rates; signup appId derived from the code.
- **Tests:** every phase updates/extends the affected suites; no phase merges red.
- **No secrets/keys touched;** Razorpay/entitlement paths unchanged except discount source + `appId` on referral.
