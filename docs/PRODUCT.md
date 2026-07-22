# Impact Loop — Product Guide

A product-manager’s reference to what the Impact Loop website is, who uses it, and how every
feature works. Written to be read without opening the code. For deploy/ops see
[DEPLOY.md](DEPLOY.md); for the email system see [EMAILS.md](EMAILS.md).

---

## 1. What this is

Impact Loop is an indie app studio (solo-run, based in India). It builds focused mobile
learning apps — the first is **CrackLoop** (tech-interview prep in short daily “loops”). The
apps are free on Google Play; paid upgrades can be bought **either** in-app (Google Play
Billing) **or on this website**, where the same upgrade is cheaper because we skip the app
store’s cut.

This website is the commerce + growth surface around the apps:

- a marketing site for each app,
- a **web store** that sells subscriptions and lifetime unlocks (INR, via Razorpay),
- a **partner (influencer) program** with promo codes, commissions, and payouts,
- an **admin console** for the owner,
- a **transactional + marketing email** system.

Payments are INR-only today; international is on the roadmap. Sign-in is Google-only.

---

## 2. Who uses it (personas)

| Persona | What they do here |
| --- | --- |
| **Visitor** | Browses the marketing pages, compares pricing, reads the FAQ/legal pages. No account needed. |
| **Buyer / Subscriber** | Signs in with Google, buys a plan (or starts a trial), manages/cancels it, sees payment history. |
| **Partner (influencer)** | Applies to the program, gets approved per app, receives a promo code, shares referral links, earns commission, requests payouts. |
| **Admin (owner)** | Approves partners, sets commission rates, manages plans/pricing, sends email campaigns, monitors revenue and webhooks, grants/revokes access. |

Roles are resolved after sign-in (`admin` > `influencer` > `user`) and route the user to the
right home: `/admin`, `/influencer`, or `/account`.

---

## 3. The public site

| Page | Purpose |
| --- | --- |
| `/` | Landing — hero, app showcase, method, pricing CTA. |
| `/apps` | Catalog of apps (live + coming-soon). |
| `/apps/[appId]` | App detail — features, screenshots, store links, web-pricing CTA. |
| `/pricing` | Live pricing from the database — per-app tiers, duration toggle, inline FAQ. |
| `/faq` | Questions about apps, billing, and the partner program. |
| `/partners` | Marketing page for the partner program. |
| `/terms`, `/privacy`, `/refund`, `/contact` | Legal + support. Refunds are handled **case-by-case over email**. |

SEO: per-page metadata, OpenGraph + Twitter cards, an Organization + per-app `SoftwareApplication`
JSON-LD, a sitemap, and `robots` that hides private routes.

---

## 4. Accounts & sign-in

- **Google sign-in only** (Firebase Authentication). No passwords, no email/password accounts.
- Signing in creates the user’s identity; the website stores their subscriptions, payment
  metadata, and (if they join) partner data in Firestore.
- Logged-out visitors can browse everything public; protected pages (`/account`, `/influencer`,
  `/admin`) show a sign-in prompt.

---

## 5. Buying a plan

### Plan shapes
Plans live in the database and are grouped by **app → tier → duration**:
- **Tiers**: e.g. `pro` (ad-free, full content) and `ai` (adds unlimited AI tutoring).
- **Durations**: monthly / multi-month **subscriptions** (recurring), or a one-time
  **lifetime** unlock.
- Each plan has a web price (in paise) and, where relevant, the Play Store price shown
  struck-through so the saving is obvious.

### Checkout flow
1. On `/pricing` (or an app page), the buyer picks a tier + duration and clicks Buy/Subscribe.
2. If not signed in, they’re prompted to sign in first.
3. The server creates the right Razorpay object:
   - **Lifetime** → a Razorpay **Order** (one-time payment).
   - **Recurring** → a Razorpay **Subscription**.
4. The Razorpay checkout modal opens. On success:
   - **Lifetime**: the client calls `/api/checkout/verify` (HMAC-verified) which grants access.
   - **Recurring**: access is granted by the Razorpay **webhook** (`subscription.charged`).
5. The buyer’s entitlement (`users/{uid}/apps/{appId}`) is written, a payment record is stored,
   and a welcome email is sent.

Prices are **always looked up server-side** — the client only sends a plan id and (optional)
promo code, so the amount can’t be tampered with.

### Promo codes & referral links
- A partner’s promo code gives the buyer the app’s configured **discount %** (and, for
  subscriptions, an equivalent number of **free days** via a delayed start).
- Buyers can type a code, **or** arrive via a partner’s referral link
  (`/apps/{id}?ref=CODE`). The referral code is captured in a cookie and **auto-applied** at
  checkout, so referred buyers get the discount without typing anything.
- Guardrails: a code is only valid for its own app, can’t be used by its owner, and must
  belong to an approved partner.

### Trials
Eligible users can start a free trial for an app (`/api/trial`) — one per user per app — which
grants temporary access without payment.

---

## 6. Managing a subscription (`/account`)

- See active plans and status per app, payment history, and any trial.
- **Cancel anytime** — access continues to the end of the paid period; no further billing.
- Apply to the partner program from here.
- **Payment receipts** are viewable/printable per payment (no GST invoice — Impact Loop isn’t
  GST-registered — but a clean receipt with amount, plan, date, and payment id).

---

## 7. Partner (influencer) program

The program is **per app** — a partner applies once (shared identity) and is then approved (or
not) for each app separately.

### Lifecycle
1. **Apply** — the user submits 1–5 social/profile links. This creates their partner identity.
2. **Enroll per app** — they opt into a specific app (e.g. CrackLoop); status starts `pending`.
3. **Admin decides** — approves or rejects the enrollment.
4. **Promo code** — once approved, the partner gets/sets a unique promo code for that app.
5. **Share** — they share referral links; buyers who use the code get the discount.
6. **Earn** — commissions accrue (see below).
7. **Payout** — they request a payout of their balance; the admin pays it out-of-band (UPI) and
   marks it paid.

### How commission is earned
- **Per-plan commission**: when a referred buyer completes a **paid** purchase, the partner
  earns the admin-set commission for that plan.
- **Signup commission** (optional): if the admin sets a signup rate, the partner earns it — but
  **only once the referred user makes their first paid purchase**, not merely on sign-up. This
  gate prevents farming commissions with throwaway accounts.
- **Reversals**: if a payment is refunded or charged back, the entitlement is revoked and the
  matching commission is reversed (voided) so it leaves the partner’s balance.

Commission math is in integer paise; a referral is recorded **once** per purchase (idempotent),
so duplicate webhook deliveries never double-credit.

### Balance & payouts
- **Balance** = sum of earned commission − sum of payouts already made.
- A partner requests a payout (full balance, with their UPI id). The admin reviews it and marks
  it paid; the payout is recorded immutably and the balance drops. Actual money movement (UPI
  transfer) is manual and out-of-band.
- The partner portal (`/influencer`) shows per-app commission, total earned, paid out, current
  balance, referral history, and payout history.

---

## 8. Admin console (`/admin`)

Gated by a Firebase custom claim (`admin === true`), set out-of-band — there is no self-serve
way to become admin. Admin API calls are re-checked server-side on every request (including a
token-revocation check).

| Tab | What the admin can do |
| --- | --- |
| **Overview** | Revenue (total / 30-day / 7-day), payment count, recent payments, user counts, subscriptions by status & tier, partner counts by status, total commission / paid-out / owed, last webhook received. |
| **Users** | Search users, see their plans and payments, **grant/revoke** access. Revoking also cancels the Razorpay subscription so billing stops. |
| **Influencers** | Approve/reject enrollments per app, set per-plan + signup commission rates, assign/replace a partner’s promo code, see earnings, create payout requests, and **mark payouts paid** (with a confirmation step, since it moves money). |
| **Pricing (Plans)** | Create plans (auto-creates the Razorpay plan for recurring), edit mutable fields, deactivate (never hard-delete, to avoid orphaned Razorpay plans). |
| **Emails** | Compose and send broadcasts to all users or approved partners; send a test to yourself first. |
| **Settings** | Toggle email sending, set which email categories are enabled, reminder window, minimum payout, etc. |
| **Webhooks** | A log of received Razorpay webhook events (for debugging fulfillment). |

Mutating admin actions are recorded to an **audit log** (actor, action path, timestamp).

---

## 9. Email system

- **Provider**: Gmail SMTP by default, behind a pluggable transport seam (a Resend/SES
  transport can be swapped in via `EMAIL_PROVIDER`).
- **Categories**: `transactional` (always sent — receipts, decisions), and opt-out categories
  `marketing`, `reminders`, `influencer`.
- **Unsubscribe**: every opt-out email carries a one-click List-Unsubscribe header (RFC 8058)
  and a footer link. Unsubscribing happens via a confirmed POST — link scanners can’t silently
  opt users out.
- **Dedupe**: sends are deduped atomically by key, so the same welcome/reminder can’t go twice.
- **Reminders**: a daily cron emails users whose subscription is nearing expiry (within the
  configured window), deduped per expiry date.
- **Broadcasts**: admin campaigns to users or partners; idempotent per campaign+recipient so a
  re-run doesn’t double-send. (Gmail caps ~500/day; large blasts or bounce handling are the
  reason to move bulk mail to a dedicated provider.)

---

## 10. Payments architecture (how money is fulfilled safely)

- **Two rails**: Razorpay **Orders** for lifetime (one-time), Razorpay **Subscriptions** for
  recurring.
- **Server-side pricing** — the amount is never trusted from the client.
- **Signatures** — both the payment callback and the webhook are HMAC-verified in constant time.
- **Webhook is the source of truth** for recurring; the verify endpoint is a fast path for
  lifetime. Both are **idempotent** (entitlements merged, payments keyed by payment id,
  referrals keyed deterministically), so verify + webhook fulfilling the same order does not
  double-grant or double-pay.
- **Refunds/chargebacks** (`refund.*` webhooks) revoke access and reverse the partner
  commission.
- **Money is integer paise everywhere** — no floating-point money.

Data lives in Firestore, which is **deny-all** to clients — everything goes through the server
(Admin SDK).

---

## 11. Cross-cutting

- **Security**: admin custom claim, deny-all Firestore rules, HMAC everywhere, a scoped
  Content-Security-Policy + standard security headers, and per-IP rate limiting on abuse-prone
  endpoints (checkout, promo validation, referral claim, trial, partner actions).
- **Observability**: errors are reported to Sentry (inert until a DSN is set); failed emails and
  webhook errors are captured, not silent.
- **Theming**: full light/dark mode; brand palette is ember-orange on ink/paper (no purple);
  CSS-driven animation throughout, all reduced-motion aware.

---

## 12. Key business rules (quick reference)

- One active plan (or lifetime) per user per app; you can’t double-buy while active.
- Lifetime commission is recorded once per user+app; refunds reverse it.
- Signup commission only pays out after the referred user’s **first paid** purchase.
- A promo code is valid only for its own app, not usable by its owner, and only while its owner
  is an approved partner.
- Subscriptions renew until cancelled; cancelling keeps access to period end.
- Refunds on web purchases are discretionary, handled over email.

---

## 13. Roadmap (what’s next)

- Automatic reversal for **subscription** refunds (lifetime is already automatic).
- Move bulk/marketing email to a provider with bounce/complaint feedback (Resend/SES).
- **International / multi-currency** pricing (currency is being abstracted out of the paise
  assumption as groundwork).
- Product analytics (funnel / conversion visibility).
- Self-serve partner payouts (currently manual UPI).
- Content surface: About, changelog/roadmap, and an FAQ rich-result schema.
