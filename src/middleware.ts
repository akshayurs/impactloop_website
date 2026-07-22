import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse, type NextRequest } from 'next/server'

// Per-IP+route sliding window on the abuse-prone public/mutating endpoints.
// No-ops (pass-through) until UPSTASH_REDIS_REST_URL/TOKEN are set, so local dev
// and unconfigured deploys are unaffected.
const url = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN

const limiter =
  url && token
    ? new Ratelimit({
        redis: new Redis({ url, token }),
        limiter: Ratelimit.slidingWindow(20, '1 m'),
        prefix: 'il_rl',
        analytics: false,
      })
    : null

export const config = {
  matcher: [
    '/api/promo/validate',
    '/api/checkout',
    '/api/checkout/verify',
    '/api/referral/claim',
    '/api/trial',
    '/api/influencer/apply',
    '/api/influencer/enroll',
    '/api/influencer/promo-code',
    '/api/influencer/payout-request',
  ],
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  if (!limiter) return NextResponse.next()
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'anon'
  const path = new URL(req.url).pathname
  const { success, reset } = await limiter.limit(`${path}:${ip}`)
  if (success) return NextResponse.next()
  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
  return NextResponse.json(
    { error: 'too many requests, please slow down' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  )
}
