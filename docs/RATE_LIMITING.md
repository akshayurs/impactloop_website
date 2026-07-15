# Rate Limiting — Vercel Firewall (WAF)

Goal: cap abuse on public routes to protect Firestore quota + Vercel invocation cost, with **zero code** (dashboard config only).

WAF keys on **IP address + request path** — it runs at Vercel's edge, *before* your function boots, so a blocked request costs ~nothing (no invocation, no Firestore read). It cannot see the Firebase UID; per-user fairness is out of scope for WAF-only (add Upstash later if needed).

---

## Plan check first

- **Hobby (free):** automatic system-level DDoS mitigation is always on. Custom **Rate Limiting rules** are a paid Firewall feature.
- **Pro:** custom rate-limiting rules included (usage counts toward the Firewall allowance).

If on Hobby, the managed DDoS + the free custom firewall rules (allow/deny/challenge by path/IP, no rate counter) still help — see "Free-tier fallback" below. Full per-path rate limits need Pro.

Set in: **Vercel Dashboard → Project → Firewall → Configure → Add Rule.**

---

## Route risk map

| Route | Auth? | Hits Firestore | Risk | Priority |
|---|---|---|---|---|
| `GET /api/promo/validate` | ❌ none | yes (per call) | anonymous scrape/brute promo codes | **highest** |
| `GET /api/v1/plans` | ❌ none | yes | anonymous scrape | **high** |
| `POST /api/checkout`, `checkout/verify` | ✅ token | yes | invocation burn + order spam | high |
| `POST /api/trial`, `referral/claim`, `influencer/apply` | ✅ token | yes | invocation burn | medium |
| `GET /api/me/*`, `/api/influencer/*` | ✅ token | yes | invocation burn | medium |
| `/api/admin/*` | ✅ admin | yes | single admin, low traffic | low |
| `POST /api/razorpay/webhook` | signature | yes | **DO NOT rate limit** (Razorpay retries) | exclude |
| Website pages (`/`, `/pricing`, …) | — | static/ISR mostly | crawler flood | low |

---

## Rules to create (in priority order)

Rate limiting evaluates rules top-down; first match wins. Put the **exclude** rule first, tightest limits next.

### Rule 0 — Bypass webhook (create FIRST)
- **If:** Request Path *equals* `/api/razorpay/webhook`
- **Then:** Bypass / Allow (skip rate limiting)
- Reason: signature-verified; Razorpay retries failed deliveries and rotates source IPs — a 429 here loses payment/subscription events.

### Rule 1 — Public unauth routes (tightest)
- **If:** Request Path *equals* `/api/promo/validate` **OR** *equals* `/api/v1/plans`
- **Then:** Rate Limit
  - **20 requests / 60s** per IP
  - Action on exceed: **Deny (429)** for 60s
- These are anonymous + Firestore-reading. A real user validates a promo a handful of times; 20/min is generous for humans, brutal for scrapers.

### Rule 2 — Sensitive auth'd mutations
- **If:** Request Path *starts with* `/api/checkout` **OR** *equals* `/api/trial` **OR** *equals* `/api/referral/claim` **OR** *equals* `/api/influencer/apply`
- **Then:** Rate Limit
  - **10 requests / 60s** per IP
  - Action: **Deny (429)**
- Even though token-gated, `requireUser` runs (an invocation) before the 401. This caps the burn from a single IP hammering with junk tokens.

### Rule 3 — Catch-all API ceiling
- **If:** Request Path *starts with* `/api/`
- **Then:** Rate Limit
  - **60 requests / 60s** per IP
  - Action: **Deny (429)**
- Safety net for every other `/api/*` route (me/*, influencer/*, subscription/*). 60/min per IP is well above normal SPA usage.

### Rule 4 — Site pages (optional, loose)
- **If:** Request Path *does not start with* `/api/`
- **Then:** Rate Limit
  - **120 requests / 60s** per IP
  - Action: **Challenge** (not Deny — avoids false-blocking real users behind shared NAT/CGNAT)
- Most pages are static/ISR (cheap), so this is anti-crawler hygiene, not cost-critical. Use Challenge, not Deny.

### Managed ruleset
- Enable Vercel's **Managed Ruleset / Bot protection** (Firewall → Managed) — covers known bad bots + OWASP-style patterns for free-to-cheap, complements the rate rules.

---

## Numbers rationale

Limits are per-IP/min. Tune after watching real traffic (Firewall → Observability shows 429 counts):
- If legit users hit 429 (shared office/college IP, CGNAT), raise the limit or switch Deny→Challenge.
- If abuse persists under the cap, lower it or add a longer block duration.

Start conservative (above), watch for a week, tighten.

---

## Free-tier fallback (Hobby, no rate-limit rules)

Custom rate counters need Pro, but on Hobby you still get, free:
1. **Automatic DDoS mitigation** — always on, no config.
2. **Custom firewall rules** (allow/deny/challenge, no counter) — e.g. Challenge all `/api/*` from datacenter ASNs, or deny known-bad IP ranges.
3. **App-level guard** (code, if you refuse Pro): a tiny check in `promo/validate` / `v1/plans` — cache the Firestore result (`Cache-Control: s-maxage`) so repeat hits serve from Vercel's edge cache and never touch Firestore. This is the cheapest real win and needs no WAF at all. `v1/plans` especially: plans change rarely → cache hard.

> Cheapest infra win regardless of plan: **edge-cache the two public GETs**. `promo/validate` is per-code but cacheable for ~30–60s; `v1/plans` can cache for minutes. That collapses Firestore reads even before any rate rule fires.

---

## After config — verify

1. Firewall → Observability: confirm rules show match counts under load.
2. Quick check: `for i in $(seq 1 30); do curl -s -o /dev/null -w "%{http_code} " https://<domain>/api/v1/plans; done` → should flip to `429` after the limit.
3. Confirm `/api/razorpay/webhook` never 429s (send a Razorpay test webhook).
