# Billing manual gate (Razorpay TEST mode)

Prereqs: .env.local filled (FIREBASE_SERVICE_ACCOUNT, RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET with TEST keys),
Firebase authorized domains include localhost + the Vercel preview domain,
Razorpay dashboard webhook -> https://<preview-domain>/api/razorpay/webhook (events: subscription.*, order.paid),
plans seeded: `node --env-file=.env.local scripts/seed-plans.mjs`,
Firestore composite index required: collection `plans` — appId ASC, active ASC, sort ASC (console link appears in server logs on first query; without it the site serves static fallback plans),
firestore rules deployed: `firebase deploy --only firestore:rules`.

Walk each row, record PASS/FAIL:

| # | Flow | Steps | Expect |
|---|------|-------|--------|
| 1 | Recurring checkout | /pricing -> Subscribe (1m pro) -> test card | Razorpay modal opens; after pay, redirected to /account |
| 2 | Webhook grant | wait ~1min after #1 | /account shows active Pro sub with renew date; Firestore users/{uid}/apps/crackloop has entitlements.adFree=true |
| 3 | Duplicate guard | /pricing -> Subscribe same app again | inline error "already have an active plan" |
| 4 | Payment history | /account | payment row with amount ₹79 |
| 5 | Cancel | /account -> Cancel -> confirm modal | status keeps until period end, autoRenewing=false, "Ends <date>" |
| 6 | Lifetime | new test user -> Buy once | order modal, verify success, /account shows Lifetime |
| 7 | Lifetime webhook backup | check Firestore webhookEvents | order.paid marker exists; no duplicate payment rows |
| 8 | Plans API | GET /api/v1/plans?app=crackloop | public fields only, no razorpayPlanId |
| 9 | Webhook security | POST garbage to /api/razorpay/webhook | 400; nothing written |

## Admin gate (after `node --env-file=.env.local scripts/set-admin.mjs <your-email>` + re-sign-in)

| # | Flow | Steps | Expect |
|---|------|-------|--------|
| A1 | Access control | open /admin signed out, as normal user, as admin | sign-in prompt / "Not authorized" / dashboard |
| A2 | Metrics | /admin after test payments | revenue matches test payments sum |
| A3 | Trial toggle | /admin/settings enable trials, save | /account (normal user) shows "Try free trial"; grant works; second request → not eligible |
| A4 | Admin trial grant | /admin/users → user → grant trial 30d | user's /account shows trial, ends in 30 days |
| A5 | Revoke | /admin/users → revoke app access | user entitlements zeroed (status revoked) |
| A6 | Plan CRUD | /admin/plans create 3m plan ₹199 | appears on /pricing + /api/v1/plans; deactivate → disappears from both |
| A7 | Webhook log | /admin/webhooks | events from earlier test payments listed |
