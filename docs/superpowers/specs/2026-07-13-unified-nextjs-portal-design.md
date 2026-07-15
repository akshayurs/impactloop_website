# Impact Loop — Unified Next.js Website & Portal (Design Spec)

**Date:** 2026-07-13
**Repo:** `impactloop_website`
**Branch:** `feat/unified-nextjs-portal` (off `main`)
**Status:** approved design — implementation to follow (phase 1 first)

## Context

Impact Loop is a white-label study-app studio. One Flutter codebase produces many branded apps
("flavors"); **CrackLoop** is the live example. The backend is a Cloudflare Worker (`ai-proxy/`)
plus Firebase (Auth, Firestore, Functions) in the `impactloop-apps` Firebase project. Full platform
context: `StudyAppTemplate/docs/firebase-data-and-flavors.md` and
`StudyAppTemplate/docs/PENDING-WORK.md` (§6 "Website").

Today this repo hosts a **marketing single-page site** (Vite + React 18 + Three.js/R3F + GSAP +
Lenis), deployed to **GitHub Pages** at `https://impactloopapps.github.io/website/`. That site must
stay live and untouched on `main` for the next few weeks. All new work happens on this branch and
deploys to Vercel previews; the GitHub Pages deploy is unaffected.

This spec defines a **unified rewrite**: one Next.js site that contains both the (ported) marketing
experience and a new authenticated **portal** for subscriptions, a creator promo/commission economy,
and admin tooling.

## Goals

- Rebuild the marketing site in Next.js, **porting the full 3D experience** (R3F hero, GPU particles,
  shaders, GSAP scroll, Lenis) — no visual downgrade.
- Add an authenticated portal on the **same Firebase project** (same Google accounts / `uid` as the
  apps).
- Sell and manage **per-app** subscriptions via **Razorpay recurring Subscriptions**.
- Run a content-creator **promo-code + commission** economy (web-only).
- Provide an **admin** surface for creators, commissions, and payouts.
- Keep the existing GitHub Pages marketing site live and unchanged during the build-out.

## Non-goals (v1)

- **No progress tracking** on the web (progress is on-device).
- **No coin wallet UI** on the web.
- **No in-app advertising of web pricing** (Play anti-steering — creators drive web traffic
  externally).
- No migration of the GitHub Pages deployment until the rewrite is ready (separate, later decision).

## Decisions (made during brainstorming — do not re-litigate)

| Decision | Choice |
| --- | --- |
| Site relationship | **Unified rewrite** — marketing + portal in one new site |
| Framework | **Next.js (App Router) + TypeScript + Tailwind** |
| Hosting | **Vercel** |
| Razorpay server logic | **In the Next.js app** (API route handlers + Firebase Admin SDK). **Subsumes the planned #4B Worker route** — no Cloudflare Worker Razorpay route needed. |
| Marketing fidelity | **Port the full 3D experience** from the current `src/` |
| Billing type | Razorpay **recurring Subscriptions** (not one-time orders) |
| Admin role | Firebase **custom claim** `admin:true` |
| Creator role | Firestore `creators/{uid}` doc with `status:"active"` |
| App registry | **Vendored** config in this repo, manually synced from flavor JSONs (no live cross-repo fetch) |
| Isolation | New branch; `main` + GitHub Pages stay live |

## Architecture

### Overview

```
Browser (Next.js client, 'use client' islands)
  ├─ Firebase JS SDK: Google auth, owner-scoped Firestore reads
  ├─ Marketing 3D (R3F/GSAP/Lenis), dynamic import ssr:false
  └─ Razorpay Checkout (client script) → opens on server-created subscription

Next.js server (route handlers on Vercel)
  ├─ Firebase Admin SDK (service-account creds in Vercel env)
  ├─ POST /api/razorpay/subscription  → create Razorpay subscription (+ promo pricing), stash notes {uid, appId, code}
  ├─ POST /api/razorpay/webhook        → verify HMAC signature over RAW body → write entitlement + redemption
  ├─ POST /api/subscription/cancel     → cancel at cycle end (verified ID token)
  ├─ creator/admin mutations           → gated by verified ID token + role
  └─ writes: users/{uid}/apps/{appId}, creators, promoCodes, redemptions, payoutRequests

Firestore (shared impactloop-apps project)
  server-write-only for entitlements/wallets/creator-economy; owner-read for the rest.
```

### Client vs server split

- **Client (`'use client'`):** marketing 3D islands, auth UI, owner-scoped reads (a user's own
  subscriptions, a creator's own redemptions). Uses the Firebase **JS SDK**.
- **Server (route handlers):** anything privileged — Razorpay order/subscription creation, webhook
  processing, entitlement writes, promo-code creation, payout state changes, admin actions. Uses the
  Firebase **Admin SDK** with service-account credentials from Vercel env vars. Every mutating route
  verifies the caller's Firebase **ID token** (and role, where required) server-side; the webhook
  verifies the Razorpay signature instead (it has no user token).

### Marketing 3D port

The current site's `src/three/*`, `src/components/*`, `src/sections/*`, shaders, and hooks are React
18 + R3F and port with minimal change. In Next.js App Router:
- WebGL/GSAP components are `'use client'` and loaded via `next/dynamic` with `{ ssr:false }` so they
  never run during SSR.
- Lenis smooth-scroll and GSAP ScrollTrigger initialize in `useEffect` (client-only).
- Self-hosted fonts move to `next/font` (or keep Fontsource imports in a client boundary).
- Preserve existing graceful fallbacks: static gradient hero when WebGL is unavailable; all motion
  disabled under `prefers-reduced-motion`; adaptive DPR/particle counts on low-power devices.

## Data model & contracts

Reuses the shared `impactloop-apps` Firestore (see `firebase-data-and-flavors.md`). The website is a
**writer of the per-app entitlement** and the **owner of the creator-economy collections**.

### Per-app entitlement (the money contract)

Write the same shape the Flutter app reads (aligns with StudyAppTemplate **#4A**):

```
users/{uid}/apps/{appId}
  entitlement: { pro: bool, ai: bool, source: "web", expiresAt: <ms> }
  subscription: { tier, status, razorpaySubscriptionId, currentPeriodEnd }
```

- **Owner-read, server-write-only.** The website writes via the Admin SDK only.
- `source:"web"` distinguishes it from Play (`source:"play"`, written by Functions).
- If #4A has not landed when phase 2 starts, the website still writes this doc; #4A governs the app's
  *reading* of it and the Functions dual-write for Play — independent of this website's writes.

### Creator economy collections (web-only; server-write-only)

- **`creators/{uid}`** — `{ uid, displayName, upiId, status: "active"|"suspended",
  defaultCommissionPct }`. Owner-read (the creator reads their own).
- **`promoCodes/{code}`** — `{ creatorId, appId|null, discountPct, commissionPct, active,
  maxRedemptions, redeemed }`.
- **`redemptions/{id}`** — `{ code, creatorId, uid, appId, grossAmount, discountAmount, razorpayFee,
  netAmount, commissionAmount, ts, payoutStatus }`. **`commissionAmount = commissionPct × netAmount`,
  recorded on the FIRST payment only** (renewals earn nothing).
- **`payoutRequests/{id}`** — `{ creatorId, amount, upiId, status: "requested"|"paid", requestedAt,
  paidAt }`. Admin pays UPI manually and marks paid.

### App registry (vendored)

`config/apps.ts` in this repo: `appId → { displayName, contentRepo, playProductIds, themeColors,
razorpayPlanIds }`. Sourced by hand from `StudyAppTemplate/app/assets/flavors/*.json`. A short
`docs/` note records the sync procedure. v1 has one entry: **crackloop**.

## Roles & authorization

- **User** — any signed-in Google account; may buy/manage their own subscriptions and apply promo
  codes.
- **Creator** — has `creators/{uid}` with `status:"active"`; may manage own promo codes, view own
  dashboard, request payouts. Provisioned by an admin.
- **Admin** — Firebase custom claim `admin:true`, set via a small one-off admin script
  (`scripts/set-admin.mjs`, run with the SA). Admin route handlers and pages verify the claim
  server-side.

## Razorpay flow (phase 2)

1. **Checkout:** client calls `POST /api/razorpay/subscription` with `{appId, tier, code?}`. Server
   verifies the ID token, resolves the plan id from the registry, applies promo pricing if `code` is
   valid+active+under `maxRedemptions`, creates a Razorpay **Subscription** with
   `notes:{uid, appId, code}`, returns the subscription id. Client opens Razorpay Checkout.
2. **Webhook:** Razorpay calls `POST /api/razorpay/webhook`. Server reads the **raw body**, verifies
   `X-Razorpay-Signature` = HMAC-SHA256(rawBody, `RAZORPAY_WEBHOOK_SECRET`). On
   `subscription.charged` → set entitlement active + `currentPeriodEnd`; on first charge for a code,
   write a `redemption`. On `subscription.cancelled|halted|completed` → mark inactive. `uid`/`appId`
   come from `notes` (or a `razorpaySubscriptions/{subId}` index doc).
3. **Cancel:** `POST /api/subscription/cancel` (verified ID token) cancels at cycle end via Razorpay
   API; entitlement stays active until `currentPeriodEnd`, then the webhook flips it.

**Secrets (Vercel env):** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`,
Firebase Admin SA credentials (`FIREBASE_SERVICE_ACCOUNT` JSON or discrete fields),
`NEXT_PUBLIC_FIREBASE_*` client config.

## Security

- **No privileged client writes.** `wallets/`, entitlement docs, and creator-economy docs are
  server-write-only (enforced by Firestore rules + Admin-SDK-only writes).
- **Webhook integrity:** verify the Razorpay signature over the raw request body before any write;
  reject otherwise. Handle idempotently (dedupe by Razorpay event id / payment id).
- **Auth binding:** entitlement writes bind to the `uid` from a verified ID token (checkout) or the
  webhook `notes` — never a forgeable client header (`X-App-Id` is tagging-only, per platform note).
- **Role checks server-side** for creator/admin mutations; never trust client-declared roles.
- **Play anti-steering:** web/promo pricing is never exposed to the mobile app.

## Testing strategy

- **Unit (Vitest):** promo discount + commission math, entitlement/subscription state mapping from
  webhook events, Razorpay signature verification, registry lookups. Pure functions isolated for
  testability.
- **CI gates:** `tsc --noEmit` and `next build`. (No device/live-payment testing in CI.)
- **Manual gates (cannot verify in CI — live money):** a real Razorpay test-mode subscription end to
  end (checkout → webhook → entitlement written → app unlocks); an admin payout cycle.

## Decomposition — build phases

Each phase gets its own implementation plan under `docs/superpowers/plans/` and is built
subagent-driven with review checkpoints. Live-money phases are merge-gated by the human after staging
verification.

1. **Foundation** — *buildable now, zero backend dependencies.* Next.js scaffold (App Router, TS,
   Tailwind), marketing 3D port, Firebase Google auth, account page, vendored app registry,
   layout/nav, legal pages (port Terms/Privacy), Vercel deploy. **Ships and is deployable standalone.**
2. **User billing** — *needs a Razorpay account + the #4A entitlement shape.* Razorpay recurring
   Subscriptions checkout, webhook + entitlement write, per-app subscription view/cancel, promo-code
   apply at checkout.
3. **Creator portal** — promo-code CRUD, earnings dashboard (redemptions + net + commission), UPI
   payout request + history. Builds on phase-2 redemption records.
4. **Admin portal** — set creator discount/commission %, approve/mark payouts paid, manage registry +
   creators, redemptions/subscriptions overview.

### External prerequisites (human/ops, block phases 2+)

- Razorpay account: recurring **Plans** (Pro, AI) per app; `RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET`.
- Firebase service-account credentials added to Vercel env.
- Razorpay webhook configured to point at the deployed `/api/razorpay/webhook`.
- Firestore rules updated in `StudyAppTemplate` for the new creator-economy collections + per-app
  entitlement (coordinate with #4A).

## Open follow-ups (later, not v1)

- Migrating the production domain / GitHub Pages to the Next.js site (separate decision after the
  rewrite is proven).
- Per-app leaderboards on the web (deferred platform-wide).
- Retiring any legacy wallet-level entitlement reads once #4A settles.
