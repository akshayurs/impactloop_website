# Email notifications

Transactional + marketing email for Impact Loop, sent via a pluggable transport
(Gmail SMTP by default, via nodemailer). All sending code lives in `src/lib/server/email/`.

Every email is declared once in the **registry** (`src/lib/server/email/registry.ts`).
That registry is the single source of truth for each email's category, admin toggle, and
default — the settings type, admin UI, and send-gate all derive from it. To add or change an
email, edit the registry; nothing else needs to change by hand.

## Setup

1. In the Google account used for sending (e.g. `impactloopapps@gmail.com`): enable
   2-Step Verification, then create an **App password** (Security → App passwords).
2. Set env vars (Vercel → Settings → Environment Variables, and `.env.local` for dev):
   - `GMAIL_USER` — the sending Gmail address
   - `GMAIL_APP_PASSWORD` — the app password from step 1
   - `EMAIL_UNSUB_SECRET` — long random string (`openssl rand -hex 32`), signs unsubscribe links
   - `PAYMENTS_EMAIL` — internal address that receives partner payout-request alerts (unset → skipped)
   - `CRON_SECRET` — long random string; Vercel Cron authenticates with it
3. Deploy the Firestore index change: `firebase deploy --only firestore:indexes`
   (adds a collection-group index on `apps.subscription.expiryTimeMillis` for the reminder cron).
4. In **Admin → Settings**, turn on **Emails enabled**.

Gmail caps sending at roughly **500 emails/day** — fine for now.

### Switching provider

Transport is a seam in `src/lib/server/email/mailer.ts`: one `EmailTransport` per provider,
selected by the `EMAIL_PROVIDER` env var (default `gmail`). To move to Resend/Brevo/SES:

1. Implement an `EmailTransport` (`configured()` + `send(msg)`) for the provider.
2. Register it in the `PROVIDERS` map.
3. Set `EMAIL_PROVIDER=<name>`, the provider's API key, and `EMAIL_FROM` (the verified
   sending address, e.g. `"Impact Loop" <no-reply@yourdomain.com>`).

No caller changes are needed. `EMAIL_UNSUB_SECRET` is still required for any provider (it
signs unsubscribe links). Free tiers worth noting: **Resend** (3k/mo, 100/day),
**Brevo** (300/day). Gmail stays the zero-setup free default.

## What gets sent, and when

| Email | Trigger | Category | Admin toggle |
| --- | --- | --- | --- |
| Welcome + how to get started | First successful purchase per user+app (subscription webhook, lifetime checkout/webhook); deduped by `welcome-{uid}-{appId}` | transactional | `emailWelcome` |
| Partner approved / rejected | Admin decides an influencer application | transactional | `emailInfluencerDecision` |
| Commission earned (+ current balance) | A referral commission is recorded (webhook or checkout verify) | influencer | `emailInfluencerEarning` |
| Payout request alert (internal → `PAYMENTS_EMAIL`) | Partner submits a payout request | transactional | `emailPayoutRequest` |
| Expiry / renewal reminder | Daily cron, subscriptions expiring within N days (`emailExpiryReminderDays`); auto-renew ON → "renews soon", OFF/trial → "expires soon"; deduped per expiry timestamp | reminders | `emailExpiryReminder` |
| Announcement broadcast | Admin → Emails tab → All users | marketing | manual |
| Partner campaign nudge | Admin → Emails tab → Influencers (all or selected) | influencer | manual |

Master switch: `emailEnabled` in settings — nothing sends while it is off. Each per-email
toggle above is auto-generated from the registry and appears in **Admin → Settings**.
Every attempt (ok or failed) is logged to the `emailLog` Firestore collection.

## Templates

- `src/lib/server/email/templates/base.ts` — shared branded layout (cream/orange, 600px, table-based).
- `src/lib/server/email/templates/crackloop/` — CrackLoop-specific: welcome, expiry reminder, announcement.
  **Future apps: add a folder next to `crackloop/` and register it in `templates/index.ts`.**
- `src/lib/server/email/templates/influencer.ts` — partner program emails (site-wide, not per-app).

## Unsubscribe

Opt-out categories: `marketing`, `reminders`, `influencer` (transactional always delivers).
Footer links carry an HMAC token (`EMAIL_UNSUB_SECRET`) → `/unsubscribe?u=&c=&t=` flips
`emailPrefs/{uid}.{category}` without login; a `List-Unsubscribe` header is set too.
Re-subscribe link is offered on the confirmation page.

## Cron

`vercel.json` schedules `GET /api/cron/email-reminders` daily at 03:30 UTC (9 AM IST).
Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when the env var is set.
Manual run: `curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/email-reminders`.
