# Phase 2 — Razorpay Billing Implementation Plan (SKELETON)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).
>
> **⚠️ THIS IS A SKELETON, NOT YET EXECUTABLE.** Execution is hard-blocked on an external prerequisite: a **Razorpay account** with recurring Plans + API keys. Items that depend on Razorpay's actual API shape / your product setup are marked **`[TO-CONFIRM]`** and must be pinned (a short brainstorm) before this plan is run. Everything NOT so marked is concrete today. Do not treat `[TO-CONFIRM]` blocks as final code.

**Goal:** Sell and manage **per-app** subscriptions on the website via **Razorpay recurring Subscriptions**, writing the SAME per-app entitlement doc the mobile app already reads (locked by StudyAppTemplate #4A), with `source:"web"`.

**Architecture:** Next.js **route handlers** own Razorpay end-to-end (checkout create + webhook). Server uses the **Firebase Admin SDK** (service-account creds in Vercel env) to write the server-authoritative entitlement doc; the browser only reads its own entitlement. Razorpay webhook is HMAC-signature-verified over the raw body before any write. This **subsumes the originally-planned #4B Worker route** — no Cloudflare Worker Razorpay code.

**Tech Stack:** Next.js 14 route handlers, `firebase-admin`, `razorpay` (server SDK) + Razorpay Checkout (client), Vitest, TypeScript.

## Prerequisites (human/ops — BLOCK execution)

- [ ] Razorpay account; create recurring **Plans** for each app × tier (CrackLoop Pro, CrackLoop AI). Record their **plan IDs**.
- [ ] Obtain `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
- [ ] Firebase **service-account** JSON for the `impactloop-apps` project (Admin SDK).
- [ ] Decide the **discount mechanism** for promo codes (see `[TO-CONFIRM: promo]` below).
- [ ] After deploy: register the Razorpay **webhook** → `https://<vercel-domain>/api/razorpay/webhook`, subscribe to `subscription.*` events.
- [ ] StudyAppTemplate #4A merged + `firestore.rules` deployed (per-app entitlement doc live).

## Global Constraints

- **Entitlement contract is LOCKED by #4A — do not invent a shape.** Write `users/{uid}/apps/{appId}` with EXACTLY the fields Functions write, changing only `source`:
  ```
  subscription: { tier, status, productId, expiryTimeMillis, autoRenewing, purchaseToken?, source: "web", lastVerifiedAt }
  entitlements: { unlimitedAi: <bool>, adFree: <bool> }
  ```
  The app reads `entitlements.unlimitedAi` / `entitlements.adFree` and `subscription.tier|status` (see `StudyAppTemplate/app/lib/core/subscription/entitlement_merge.dart` + `functions/src/subscription.ts`). The website MUST mirror the SAME product→grant mapping Functions use (`entitlementsForProduct`), not a new one.
- **Server-write-only:** entitlement + creator-economy docs are written ONLY by server route handlers via Admin SDK. The browser never writes them (Firestore rules forbid it).
- **Webhook integrity:** verify `X-Razorpay-Signature` = HMAC-SHA256(rawBody, `RAZORPAY_WEBHOOK_SECRET`) over the RAW request body (read via `await req.text()`, NOT `req.json()`) before acting. Reject on mismatch. Idempotent by Razorpay event/payment id.
- **Auth binding:** the entitlement `uid`/`appId` come from a verified Firebase ID token (checkout) or the subscription's `notes` + a `razorpaySubscriptions/{subId}` index doc (webhook) — never a forgeable client header.
- **Play anti-steering:** web/promo pricing is never surfaced to the mobile app.
- **appId default `'crackloop'`** wherever it could be absent (matches #4A).
- Tests: pure logic (signature verify, event→entitlement mapping, promo/commission math) via Vitest. Route handlers/UI verified by `tsc` + `next build`. Live Razorpay flow = **manual gate** (test-mode subscription end-to-end).
- Next 14 / React 18 pin holds (phase-1 constraint).

---

### Task 1: Firebase Admin SDK server module  *(concrete)*

**Files:** Create `src/lib/firebase-admin.ts`, `src/lib/verify-id-token.ts`; update `.env.local.example`.

**Interfaces:**
- Produces: `adminApp`, `adminDb` (Firestore via `firebase-admin/firestore`), `adminAuth`; `verifyIdToken(req): Promise<{uid: string}>` (reads `Authorization: Bearer <idToken>`, verifies via Admin SDK, throws 401 on failure).

- [ ] **Step 1:** Add `firebase-admin` dep (`pnpm add firebase-admin`).
- [ ] **Step 2:** `firebase-admin.ts` — initialize with the SA credential from env (`FIREBASE_SERVICE_ACCOUNT` JSON string → `cert(...)`), guarded against re-init (`getApps().length`). Export `adminDb`, `adminAuth`. Server-only (never imported by a client component — this is the phase-1 punch-list fix: keep client `firebase.ts` and this admin module strictly separate).
- [ ] **Step 3:** `verify-id-token.ts` — extract bearer token, `adminAuth.verifyIdToken`, return `{uid}`; throw a typed 401 error otherwise.
- [ ] **Step 4:** Add `FIREBASE_SERVICE_ACCOUNT`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` to `.env.local.example` (blank).
- [ ] **Step 5:** `pnpm typecheck && pnpm build`. Commit.

---

### Task 2: Product→entitlement grant map (mirror #4A) + entitlement writer  *(concrete)*

**Files:** Create `src/lib/entitlement.ts`, `src/lib/entitlement.test.ts`.

**Interfaces:**
- Produces: `entitlementsForProduct(productId): { unlimitedAi: boolean; adFree: boolean; tier: 'standard'|'higher' }` — MUST match `functions/src/subscription.ts`'s mapping for the shared product ids (`pro_monthly`, `ai_monthly`, legacy ids). `writeEntitlement(uid, appId, { productId, status, expiryMillis, autoRenewing, subId }): Promise<void>` — writes the #4A doc shape with `source:"web"` via `adminDb`.

- [ ] **Step 1 (TDD):** Write `entitlement.test.ts` asserting the grant map for each product id EXACTLY matches the values `functions/src/subscription.ts` produces (read that file; copy its truth table into the test). Also assert `status:"expired"` → both grants false.
- [ ] **Step 2:** RED.
- [ ] **Step 3:** Implement `entitlementsForProduct` (ported from Functions) + `writeEntitlement` (Admin SDK `set({...},{merge:true})` on `users/{uid}/apps/{appId}`, entitlements gated by active status, `source:"web"`, `lastVerifiedAt` server timestamp).
- [ ] **Step 4:** GREEN. `pnpm typecheck`. Commit.

---

### Task 3: Razorpay signature verification (pure)  *(concrete)*

**Files:** Create `src/lib/razorpay-signature.ts`, `src/lib/razorpay-signature.test.ts`.

**Interfaces:** Produces `verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean` (HMAC-SHA256, constant-time compare).

- [ ] **Step 1 (TDD):** test with a known body+secret→expected HMAC (compute the expected value once with node crypto and hard-code it), plus a tamper case → false.
- [ ] **Step 2:** RED.
- [ ] **Step 3:** Implement using Node `crypto.createHmac('sha256', secret).update(rawBody).digest('hex')` + `crypto.timingSafeEqual`. (Route handlers run in the Node runtime on Vercel — set `export const runtime = 'nodejs'` in the webhook route.)
- [ ] **Step 4:** GREEN. Commit.

---

### Task 4: Webhook event → entitlement mapping (pure)  *(concrete logic; event names `[TO-CONFIRM]`)*

**Files:** Create `src/lib/razorpay-events.ts`, `src/lib/razorpay-events.test.ts`.

**Interfaces:** Produces `mapSubscriptionEvent(event): { active: boolean } | null` — maps a Razorpay subscription webhook event to entitlement active/inactive; `null` = ignore.

- [ ] **Step 1 (TDD):** assert `subscription.charged`/`subscription.activated` → `{active:true}`; `subscription.cancelled`/`subscription.halted`/`subscription.completed` → `{active:false}`; unknown → `null`.
  - **`[TO-CONFIRM: events]`** Verify the exact Razorpay recurring-subscription event names + which carry the renewal charge, against current Razorpay webhook docs before finalizing this table.
- [ ] **Step 2:** RED → implement → GREEN. Commit.

---

### Task 5: Checkout route — create subscription  *(structure concrete; Razorpay payload `[TO-CONFIRM]`)*

**Files:** Create `src/app/api/razorpay/subscription/route.ts`; update `src/config/apps.ts` (fill `razorpayPlanIds`).

**Interfaces:** `POST /api/razorpay/subscription` body `{ appId, tier: 'pro'|'ai', code? }` → verifies ID token (Task 1), resolves plan id from registry, applies promo (Task 7), creates a Razorpay subscription with `notes:{uid, appId, tier, code}`, writes `razorpaySubscriptions/{subId}` index doc `{uid, appId, tier, code}`, returns `{ subscriptionId }`.

- [ ] **Step 1:** `export const runtime = 'nodejs'`. Verify ID token; 401 if absent/invalid.
- [ ] **Step 2:** Resolve `razorpayPlanIds[tier]` from `getApp(appId)`; 400 if unknown app/tier or plan id not configured.
- [ ] **Step 3 `[TO-CONFIRM: razorpay-api]`:** Create the subscription via the `razorpay` server SDK. Exact call (`razorpay.subscriptions.create({ plan_id, total_count, notes, ... })`), how `total_count`/`customer_notify`/offers are set, and the promo/offer attachment — pin against the current Razorpay Node SDK + your plan setup. Do NOT ship guessed field names.
- [ ] **Step 4:** Write the `razorpaySubscriptions/{subId}` index doc (Admin SDK) for reliable webhook recovery.
- [ ] **Step 5:** `pnpm typecheck && pnpm build`. Commit. (End-to-end verified only in the manual gate.)

---

### Task 6: Webhook route — verify + write entitlement (+ redemption)  *(structure concrete; payload shape `[TO-CONFIRM]`)*

**Files:** Create `src/app/api/razorpay/webhook/route.ts`.

**Interfaces:** `POST /api/razorpay/webhook` → raw body → `verifyWebhookSignature` (Task 3) → parse → `mapSubscriptionEvent` (Task 4) → resolve `{uid, appId, tier, code}` from the event's `notes` or the `razorpaySubscriptions/{subId}` index doc → `writeEntitlement` (Task 2) → on first successful charge with a `code`, record a `redemptions/{id}` doc (commission math Task 7). Idempotent by event/payment id.

- [ ] **Step 1:** `export const runtime = 'nodejs'`. Read `await req.text()` (raw). Verify signature; 400 on mismatch (do not parse first).
- [ ] **Step 2 `[TO-CONFIRM: payload]`:** parse the event; extract subscription id, product/plan, current period end, `notes`. Pin the exact JSON paths against a real Razorpay webhook sample.
- [ ] **Step 3:** resolve uid/appId/tier/code (notes → fallback index doc); map product→`productId` for the shared grant map (Task 2).
- [ ] **Step 4:** `writeEntitlement(uid, appId, {...})` with `active` from Task 4 → `status`, `expiryMillis` from the period end.
- [ ] **Step 5:** idempotency — dedupe on Razorpay event id (a `webhookEvents/{eventId}` marker doc, create-if-absent; skip if seen).
- [ ] **Step 6 (redemption):** if first charge AND `code` present, write `redemptions/{id}` (`code, creatorId, uid, appId, grossAmount, discountAmount, razorpayFee, netAmount, commissionAmount, ts, payoutStatus:'unpaid'`), commission from Task 7. (Creator dashboard/payout = phase 3.)
- [ ] **Step 7:** `pnpm typecheck && pnpm build`. Commit.

---

### Task 7: Promo code apply + commission math (pure + read)  *(math concrete; discount mechanism `[TO-CONFIRM]`)*

**Files:** Create `src/lib/promo.ts`, `src/lib/promo.test.ts`.

**Interfaces:** `applyPromo(gross, promo): { discountAmount, netAmount }`; `commissionFor(netAmount, commissionPct): number`; `validatePromo(code): Promise<PromoCode|null>` (reads `promoCodes/{code}` via Admin SDK; active + under `maxRedemptions`).

- [ ] **Step 1 (TDD):** discount = `round(gross × discountPct)`, net = gross − discount; commission = `round(net × commissionPct)`; **first payment only** (caller enforces). Edge cases: 0%, capped redemptions.
- [ ] **Step 2:** RED → implement pure math → GREEN.
- [ ] **Step 3 `[TO-CONFIRM: promo]`:** how the discount is realized in Razorpay recurring (an **Offer** attached at subscription create, vs a discounted first invoice, vs a separate discounted plan) determines whether `applyPromo` output feeds the checkout call or is only recorded for commission. Pin before wiring into Task 5. Renewals earn no commission.
- [ ] **Step 4:** Commit.

---

### Task 8: Client — pricing, checkout, subscription view + cancel  *(structure concrete; Checkout embed `[TO-CONFIRM]`)*

**Files:** Create `src/app/pricing/page.tsx` + `src/components/Pricing.tsx`; `src/app/api/subscription/cancel/route.ts`; update `src/components/AccountView.tsx` (real per-app subscription read replacing the phase-1 placeholder).

**Interfaces:** Pricing shows per-app tiers; "Subscribe" calls `/api/razorpay/subscription`, opens Razorpay Checkout with the returned subscription id; AccountView reads the user's own `users/{uid}/apps/{appId}` (client Firestore, owner-read) to show status + a Cancel button → `POST /api/subscription/cancel` (verify token, cancel at cycle end via Razorpay SDK).

- [ ] **Step 1:** AccountView — replace "No active subscription" with a live read of `users/{uid}/apps/{appId}` via the client SDK (owner-read allowed by #4A rule); show tier/status/renewal.
- [ ] **Step 2 `[TO-CONFIRM: checkout]`:** integrate Razorpay Checkout (script embed + handler) — pin the current Checkout snippet + how a subscription id is passed. Self-host or CSP-allow per constraints.
- [ ] **Step 3:** cancel route (verify token → Razorpay `subscriptions.cancel(subId, { cancel_at_cycle_end: true })`; entitlement flips via the webhook at period end).
- [ ] **Step 4:** promo code input on pricing → passes `code` to the checkout call.
- [ ] **Step 5:** `pnpm typecheck && pnpm build`. Commit.

---

## Verification & manual gates

- **Automated (CI):** Vitest for Tasks 2,3,4,7 (pure logic); `tsc --noEmit` + `next build` for routes/UI.
- **Manual gate (live money — before merge):** Razorpay **test mode** end-to-end — subscribe → webhook fires → per-app entitlement written with `source:"web"` → mobile app (or AccountView) unlocks; cancel → entitlement flips at period end; a promo code records a `redemptions` doc with correct commission. Confirm signature rejection on a tampered webhook.

## Open forks to pin before execution (the `[TO-CONFIRM]`s)
1. **Razorpay recurring API specifics** (Tasks 5,6,8): exact SDK calls, subscription-create payload, webhook event names + JSON paths, Checkout embed — against the CURRENT Razorpay docs + your account's plans. (Do a short brainstorm with the Razorpay dashboard open.)
2. **Promo discount mechanism** (Task 7): Offer vs discounted invoice vs discounted plan — shapes checkout wiring + the creator-economy phase.
3. **Entitlement field naming sanity check:** confirm `pro` tier maps to `adFree` and `ai` tier to `unlimitedAi` (or the real intended grants) against `functions/src/subscription.ts` `entitlementsForProduct` — Task 2's test locks whatever that file actually does.

## Self-Review (skeleton scope)
Covers the phase-2 spec (Razorpay checkout + webhook + per-app entitlement `source:"web"` + promo apply + subscription view/cancel). Pure-logic tasks (2,3,4,7) are fully concrete and TDD-ready now; route/UI tasks (5,6,8) are structurally concrete but carry `[TO-CONFIRM]` blocks for Razorpay-account-specific API details that must not be guessed for live-money code. Creator dashboard + payouts + admin = phases 3–4 (separate plans). No fabricated Razorpay API code committed.
