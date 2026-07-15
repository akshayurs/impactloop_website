export function formatINR(paise: number): string {
  if (!Number.isInteger(paise) || paise < 0) {
    throw new Error(`invalid paise amount: ${paise}`)
  }
  const rupees = paise / 100
  const hasFraction = paise % 100 !== 0
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(rupees)
}
