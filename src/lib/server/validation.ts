import { z } from 'zod'
import { PROMO_CODE_RE } from './promo'

/** Thrown when a request body/query fails schema validation. Routes map it to 400. */
export class ValidationError extends Error {
  status = 400
}

/** Parse+validate a JSON request body against a schema, or throw ValidationError. */
export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  const raw = await req.json().catch(() => ({}))
  const result = schema.safeParse(raw)
  if (!result.success) throw new ValidationError(result.error.issues[0]?.message ?? 'invalid request')
  return result.data
}

/** Validate an already-parsed value (e.g. query params), or throw ValidationError. */
export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) throw new ValidationError(result.error.issues[0]?.message ?? 'invalid request')
  return result.data
}

// ——— Reusable field schemas ———
export const appIdSchema = z.string().min(1).max(64)
export const planIdSchema = z.string().min(1).max(64)
export const promoCodeSchema = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .refine((s) => PROMO_CODE_RE.test(s), 'invalid promo code')
export const upiIdSchema = z.string().regex(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/, 'enter a valid UPI ID (e.g. name@bank)')
export const httpUrl = z.string().refine((s) => {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}, 'must be an http(s) URL')

// ——— Route body schemas ———
export const checkoutSchema = z.object({
  planId: planIdSchema,
  promoCode: promoCodeSchema.optional(),
})

export const verifySchema = z.object({
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  signature: z.string().min(1),
})

export const referralClaimSchema = z.object({ code: promoCodeSchema })
export const appOnlySchema = z.object({ appId: appIdSchema })
export const applySchema = z.object({ socialLinks: z.array(httpUrl).min(1).max(5) })
export const changePromoSchema = z.object({ appId: appIdSchema.optional(), code: promoCodeSchema })
export const payoutRequestSchema = z.object({ appId: appIdSchema.optional(), upiId: upiIdSchema })
