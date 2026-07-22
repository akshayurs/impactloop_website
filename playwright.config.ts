import { defineConfig, devices } from '@playwright/test'

// E2E against the public site. Set E2E_BASE_URL to test a deployed/staging URL;
// otherwise Playwright boots the local dev server. Auth/checkout flows need real
// Google + Razorpay and are covered manually on staging (see docs/DEPLOY.md).
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
