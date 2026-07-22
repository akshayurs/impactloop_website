# Email System — Architecture & Roadmap (for humans and AI agents)

> Companion to [`docs/EMAILS.md`](./EMAILS.md), which is the operator/setup guide.
> This file explains **how the system is wired, why, where every trigger lives, and how to
> extend it toward a corporate-grade setup.** Read this before touching email code.

All email code lives under `src/lib/server/email/`. Two things anchor the system:

- **The registry** [`registry.ts`](../src/lib/server/email/registry.ts) — the single source of
  truth. Every email is one entry (id, category, admin toggle, default, automatic/manual). The
  settings type + defaults, the admin toggle UI, and the send-gate all **derive** from it.
  Adding or changing an email = editing this file; nothing else needs hand-editing.
- **The choke point** — every send routes through **`sendEmail()`** in
  [`mailer.ts`](../src/lib/server/email/mailer.ts), which now sends via a pluggable transport.

If you are adding, gating, or debugging an email, start with those two.

---

## 1. How email is triggered

There are exactly **two ways** an email is produced:

### A. Event-driven (automatic)
Business flows call a `notify*` / `send*` helper in
[`notify.ts`](../src/lib/server/email/notify.ts). Each helper is **fire-safe** — it
wraps everything in try/catch and swallows errors, so a Gmail hiccup can never fail a
payment or admin action.

| Email | Helper | Called from | Category | Sender toggle | Dedupe key |
|---|---|---|---|---|---|
| Welcome / getting started | `notifyPurchase` | Razorpay webhook + lifetime checkout/verify (first successful purchase per user+app) | `transactional` | `emailWelcome` | `welcome-{uid}-{appId}` |
| Partner approved / rejected | `notifyInfluencerDecision` | Admin approves/rejects an influencer application | `transactional` | `emailInfluencerDecision` | — |
| Commission earned (+ balance) | `notifyCommission` | Referral commission recorded (webhook or checkout verify) | `influencer` | `emailInfluencerEarning` | — |
| Payout-request alert (**internal**, to `PAYMENTS_EMAIL`) | `notifyPayoutRequest` | Partner submits a payout request | `transactional` | `emailPayoutRequest` | — |
| Expiry / renewal reminder | `sendExpiryReminder` | Daily cron, subs expiring within `emailExpiryReminderDays` | `reminders` | `emailExpiryReminder` | `reminder-{uid}-{appId}-{expiryMillis}` |

Each helper gates on `isEmailSenderEnabled(id, settings)` from the registry — one call that
checks the master switch **and** the per-email toggle — instead of hand-written `if` checks,
and reads its category from `EMAILS[id].category` so the category can never drift.

The cron ([`api/cron/email-reminders/route.ts`](../src/app/api/cron/email-reminders/route.ts))
runs daily at **03:30 UTC (9 AM IST)** via `vercel.json`, authenticated by
`Authorization: Bearer $CRON_SECRET`. It queries a Firestore collection-group index on
`apps.subscription.expiryTimeMillis`, filters to live/trial subs, and calls
`sendExpiryReminder` per match. Dedupe per expiry timestamp means re-running the cron is safe.

### B. Manual broadcast (admin)
`POST /api/admin/email` ([route](../src/app/api/admin/email/route.ts)) drives the two manual sends:

| Email | Audience | Category | Template |
|---|---|---|---|
| Announcement broadcast | all Firebase Auth users with an email | `marketing` | app `announcement` |
| Partner campaign nudge | `influencers` where `status == approved` (optionally filtered by `uids[]`) | `influencer` | `influencerCampaign` |

Admin UI: **Admin → Emails tab** ([page](../src/app/admin/emails/page.tsx)).
`action: 'test'` sends a single `[TEST]` copy to the admin's own address instead of the audience.

---

## 2. The send pipeline (single choke point)

`sendEmail()` applies these gates **in order** — an email only goes out if all pass:

1. `emailConfigured()` — `EMAIL_UNSUB_SECRET` present **and** the active transport is configured.
2. `getSettings().emailEnabled` — the **master switch** (Admin → Settings). Off ⇒ nothing sends.
3. **Opt-out check** — if the category is opt-out (`marketing`/`reminders`/`influencer`),
   read `emailPrefs/{uid}` and skip if the user unsubscribed. `transactional` skips this check.
4. **Dedupe** — if `dedupeKey` is set and an `emailLog/{dedupeKey}` doc already exists, skip.
5. Send via the active transport; **log every attempt** (ok or failed) to the `emailLog`
   Firestore collection.

Transport is a **pluggable seam**: `EmailTransport` interface + a `PROVIDERS` map, selected by
`EMAIL_PROVIDER` (default `gmail`). The Gmail impl uses nodemailer, pooled (`maxConnections: 3`),
cached module-level. `from` comes from `EMAIL_FROM` (falls back to the Gmail address).
`List-Unsubscribe` header is attached for opt-out categories. Adding Resend/Brevo/SES = one
new `EmailTransport` + a `PROVIDERS` entry; no caller changes. See EMAILS.md → "Switching provider".

> **Key invariant:** per-email *sender* toggles are checked in the `notify*` helpers / cron via
> `isEmailSenderEnabled(id, settings)` **before** calling `sendEmail`, while the *master* switch
> and *recipient* opt-out are checked **inside** `sendEmail`. Two different layers — see §4.

---

## 3. Templates

- [`templates/base.ts`](../src/lib/server/email/templates/base.ts) — shared branded layout
  (cream `#f6f2ea` / orange `#e8500a`, 600px, table-based, inline styles for client compat).
  Helpers: `paragraphs`, `bulletList`, `statBox`, `ctaButton`, `renderBaseEmail`. `esc()` escapes all user input.
- [`templates/crackloop/`](../src/lib/server/email/templates/crackloop/) — per-app set:
  `welcome`, `expiryReminder`, `announcement`. Shape defined by `AppEmailTemplates` in
  [`templates/types.ts`](../src/lib/server/email/templates/types.ts).
- [`templates/influencer.ts`](../src/lib/server/email/templates/influencer.ts) — partner
  program emails (site-wide, not per-app): approved/rejected/earning/payout-alert/campaign.
- [`templates/index.ts`](../src/lib/server/email/templates/index.ts) — `getAppTemplates(appId)`
  registry. **To add an app: create a folder next to `crackloop/` and register it here.**

Templates are **pure functions** (input → `{subject, html}`). No DB reads, no side effects.

---

## 4. Turning individual emails on/off

There are **two independent layers**. Both must allow the send.

**Sender side (admin decides which emails the product sends):**
- Master: `emailEnabled` (default `false`).
- Per automatic email: `emailWelcome`, `emailInfluencerDecision`, `emailInfluencerEarning`,
  `emailExpiryReminder`, `emailPayoutRequest` (+ the `emailExpiryReminderDays` number). These
  are **declared in the registry** and flow into the `GlobalSettings` type + `DEFAULT_SETTINGS`
  ([`settings.ts`](../src/lib/server/settings.ts)) and the admin toggle list
  ([`settings.tsx`](../src/components/admin/settings.tsx)) automatically. Add a registry entry
  with a `toggleKey` and a new toggle appears end-to-end with no other edits.

**Recipient side (each user opts out per category):**
- `emailPrefs/{uid}` stores booleans for `marketing` / `reminders` / `influencer`
  ([`prefs.ts`](../src/lib/server/email/prefs.ts)). Default all `true`.
- Flipped without login via the HMAC-signed unsubscribe link
  (`/unsubscribe?u=&c=&t=`, token = `EMAIL_UNSUB_SECRET`) — see
  [`unsubscribe/page.tsx`](../src/app/unsubscribe/page.tsx).
- `transactional` cannot be opted out (receipts, decisions, payout alerts).

**Remaining gaps:**
- The two manual broadcasts have no toggle (acceptable — they're manual). Add one by giving the
  registry entry a `toggleKey`.
- Recipient opt-out granularity is per *category*, not per *email*.

---

## 5. Triggering a batch

`POST /api/admin/email` with body:
```jsonc
{
  "audience": "users" | "influencers",
  "uids": ["..."],          // optional, influencers only, max 500 — filters the audience
  "subject": "...",         // required, ≤150 chars
  "message": "...",         // required, ≤5000 chars, blank-line = new paragraph
  "ctaLabel": "...",        // optional
  "ctaUrl": "https://...",  // optional, must be http(s)
  "appId": "crackloop",     // which app's announcement template (users audience)
  "action": "test"          // optional — sends one [TEST] copy to the admin only
}
```
- Recipients: `listAllUsers()` pages Firebase Auth 1000 at a time; `listInfluencers()` reads
  approved influencers then resolves emails in batches of 100.
- Sends in **chunks of 5 concurrent** (`CONCURRENCY = 5`), returns `{total, sent, skipped, failed}`.
- **No dedupe** on broadcasts — re-running sends again. Opt-out is still honoured (counts as `skipped`).
- Runs **synchronously inside the request** (`maxDuration = 300`s). This is the main scale limit.

---

## 6. Triggering a marketing email with a *saved* template

**Not supported today.** Every broadcast is composed from scratch: the admin types
subject + message + optional CTA, which are injected into the `announcement` /
`influencerCampaign` layout. There is no stored, reusable, named template.

To add saved marketing templates (recommended shape):
1. Firestore `emailTemplates` collection: `{ id, name, audience, subject, message, ctaLabel,
   ctaUrl, appId, updatedAt }`.
2. Admin → Emails: a picker to load a saved template into the compose form (still editable),
   plus save/update/delete.
3. Optional: a `{{name}}`-style merge-field pass in `renderFor` so templates personalise.
4. Reuse the existing `POST /api/admin/email` path unchanged — the template just pre-fills the body.

---

## 7. Making it corporate-grade

**Done:**
- ✅ **Data-driven email manifest** — [`registry.ts`](../src/lib/server/email/registry.ts) is
  now the single source of truth; settings type/defaults, admin toggles, and the send-gate all
  derive from it.
- ✅ **Pluggable transport seam** — `EmailTransport` + `PROVIDERS` map in `mailer.ts`, selected by
  `EMAIL_PROVIDER`. Gmail stays the free default; adding Resend/Brevo/SES is one file.
- ✅ **Closed the payout-alert toggle gap** (`emailPayoutRequest`).

**Next (highest leverage first):**
1. **Suppression list + bounce handling.** Persist hard bounces/complaints and skip them in
   `sendEmail` (a 4th gate). Needs a provider with bounce webhooks (Resend/Brevo) — Gmail SMTP
   gives no delivery feedback, which is the main reason to move off it eventually.
2. **Async broadcast queue.** Replace the in-request loop with a job (Vercel cron / queue /
   background function) so large sends don't hit the 300s ceiling and can retry per-recipient.
3. **Idempotency for broadcasts.** Give them an optional `dedupeKey` (e.g.
   `campaign-{campaignId}-{uid}`) so re-runs don't double-send.
4. **Scheduling.** Let admins schedule a broadcast for a future time (store campaign + fire via cron).
5. **Saved templates + versioning + preview** (see §6), plus an in-admin HTML preview and a
   real test-send (already partially there via `action: 'test'`).
6. **Per-email recipient prefs + preference centre.** A logged-in page listing every email type
   with individual toggles, backed by finer-grained `emailPrefs`.
7. **Observability.** `emailLog` already records every attempt — add an admin view with
   filters (category, ok/failed, date) and, once on a real provider, open/click/bounce status.

---

## 8. Where to look (quick map)

| Concern | File |
|---|---|
| **Email registry (single source of truth)** | [`registry.ts`](../src/lib/server/email/registry.ts) |
| Send choke point, transport seam, dedupe, logging | [`mailer.ts`](../src/lib/server/email/mailer.ts) |
| Automatic email triggers | [`notify.ts`](../src/lib/server/email/notify.ts) |
| Recipient opt-out, unsubscribe tokens | [`prefs.ts`](../src/lib/server/email/prefs.ts) |
| Admin sender toggles | [`settings.ts`](../src/lib/server/settings.ts) |
| Manual broadcast API | [`api/admin/email/route.ts`](../src/app/api/admin/email/route.ts) |
| Reminder cron | [`api/cron/email-reminders/route.ts`](../src/app/api/cron/email-reminders/route.ts) |
| Shared layout + helpers | [`templates/base.ts`](../src/lib/server/email/templates/base.ts) |
| Per-app template registry | [`templates/index.ts`](../src/lib/server/email/templates/index.ts) |
| Partner (site-wide) templates | [`templates/influencer.ts`](../src/lib/server/email/templates/influencer.ts) |
| Unsubscribe page | [`unsubscribe/page.tsx`](../src/app/unsubscribe/page.tsx) |
| Operator/setup guide | [`docs/EMAILS.md`](./EMAILS.md) |
