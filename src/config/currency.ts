/**
 * Currency/locale config. Today the store is INR-only, but money formatting and the
 * "minor unit" (paise) assumption are routed through here so adding a currency later is a
 * config change, not a code hunt. Actual multi-currency *pricing* (per-currency prices +
 * Razorpay International) is a separate product/ops decision — see docs/PRODUCT.md roadmap.
 */
export type CurrencyCode = 'INR'

export type CurrencyConfig = {
  code: CurrencyCode
  /** BCP-47 locale for Intl formatting. */
  locale: string
  /** Minor units per major unit (paise per rupee = 100). */
  minorPerMajor: number
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  INR: { code: 'INR', locale: 'en-IN', minorPerMajor: 100 },
}

export const DEFAULT_CURRENCY: CurrencyCode = 'INR'
