import { expect, test } from '@playwright/test'

test('home renders with nav', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Impact Loop/)
  await expect(page.getByRole('link', { name: 'Impact Loop home' })).toBeVisible()
})

test('pricing shows plans, promo affordance, and sign-in CTA', async ({ page }) => {
  await page.goto('/pricing')
  await expect(page.getByRole('heading', { name: /Same app/i })).toBeVisible()
  await expect(page.getByText('Have a promo code?').first()).toBeVisible()
  await expect(page.getByText('Sign in to subscribe').first()).toBeVisible()
})

test('a referral link auto-applies the invite code on the pricing page', async ({ page }) => {
  await page.goto('/?ref=FAKEINVITE') // ReferralCatcher stores the cookie
  await page.goto('/pricing')
  await expect(page.getByText('Invite code applied from your link:').first()).toBeVisible()
})

test('key content and legal pages load', async ({ page }) => {
  test.slow() // visits many pages; dev cold-compiles each on first hit
  for (const path of ['/apps', '/faq', '/partners', '/about', '/changelog', '/terms', '/privacy', '/refund', '/contact']) {
    const res = await page.goto(path)
    expect(res?.ok(), `${path} should respond 2xx`).toBeTruthy()
  }
})

test('an unknown app shows the branded not-found page', async ({ page }) => {
  await page.goto('/apps/does-not-exist')
  await expect(page.getByText('This loop is')).toBeVisible()
})
