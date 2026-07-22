import { CURRENCIES, DEFAULT_CURRENCY, type CurrencyCode } from '@/config/currency'

/** Format an integer minor-unit amount (e.g. paise) in the given currency. */
export function formatMoney(minor: number, currency: CurrencyCode = DEFAULT_CURRENCY): string {
  if (!Number.isInteger(minor)) {
    throw new Error(`invalid minor amount: ${minor}`)
  }
  const c = CURRENCIES[currency]
  const major = minor / c.minorPerMajor
  const hasFraction = minor % c.minorPerMajor !== 0
  return new Intl.NumberFormat(c.locale, {
    style: 'currency',
    currency: c.code,
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(major)
}

/** Back-compat helper — INR is the only live currency today. */
export function formatINR(paise: number): string {
  return formatMoney(paise, 'INR')
}
