# App Registry — Manual Sync Process

The `src/config/apps.ts` registry is a **vendored copy** of app metadata from the StudyAppTemplate flavor definitions. It is **not** auto-generated and must be manually synced when new apps are created or flavor settings change.

## Registry Structure

Each app entry in `APPS` contains:

```ts
{
  appId: string                  // Unique identifier used in URLs, API calls, client requests
  displayName: string            // Human-readable app name for UI display
  contentRepo: string            // GitHub repo in format "owner/repo" (e.g. "akshayurs/CrackLoopData")
  playProductIds: {
    pro: string                  // Google Play product ID for pro subscription
    ai: string                   // Google Play product ID for AI tutor subscription
  }
  razorpayPlanIds: {
    pro: string | null           // Razorpay plan ID for pro subscription (null until configured)
    ai: string | null            // Razorpay plan ID for AI subscription (null until configured)
  }
  theme: {
    primary: string              // Primary brand color (hex)
    accent: string               // Accent brand color (hex)
  }
}
```

## Sync from StudyAppTemplate

When a new app is created or an existing flavor is updated in StudyAppTemplate:

1. **Source location:** `StudyAppTemplate/app/assets/flavors/<flavor>.json`
2. **Extract fields:**
   - `appId` from root (e.g. `"appId": "crackloop"`)
   - `displayName` from root
   - `content.repo` from the content block (format: `owner/repo`)
   - `subscriptions.proProductId` and `subscriptions.aiProductId` → map to `playProductIds.pro` and `.ai`
   - `theme.primary` and `theme.accent` from root
3. **Add to registry:** Open `src/config/apps.ts`, add/update the entry in `APPS`, ensure type safety
4. **Set Razorpay IDs:** Once Razorpay plans are created in the dashboard, update `razorpayPlanIds.pro` and `razorpayPlanIds.ai` (currently null for all apps)
5. **Test:** Run `pnpm test src/config/apps.test.ts` to confirm type checks pass
6. **Typecheck:** Run `pnpm typecheck` to verify no type errors
7. **Commit:** Include the registry update in the same commit as any related changes

## Example: Adding CrackLoop

Source (`StudyAppTemplate/app/assets/flavors/crackloop.json`):
```json
{
  "appId": "crackloop",
  "displayName": "CrackLoop",
  "content": { "repo": "akshayurs/CrackLoopData" },
  "subscriptions": {
    "proProductId": "pro_monthly",
    "aiProductId": "ai_monthly"
  },
  "theme": {
    "primary": "#7C5CFF",
    "accent": "#22D3EE"
  }
}
```

Registry entry in `src/config/apps.ts`:
```ts
crackloop: {
  appId: 'crackloop',
  displayName: 'CrackLoop',
  contentRepo: 'akshayurs/CrackLoopData',
  playProductIds: { pro: 'pro_monthly', ai: 'ai_monthly' },
  razorpayPlanIds: { pro: null, ai: null },
  theme: { primary: '#7C5CFF', accent: '#22D3EE' }
}
```

## Current Apps

- **crackloop:** DSA + technical interview prep; uses CrackLoopData content repo

## When to Update

- New app is added to StudyAppTemplate
- An existing app's display name, branding, or Play product IDs change
- Content repo URL changes
- Razorpay plans are created for a subscription tier
