'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function calculateFreeDays(durationMonths: number | null, discountPct: number): number {
  if (durationMonths === null) return 0
  return Math.max(0, Math.round((durationMonths * 30 * discountPct) / 100))
}

export function PromoInput({
  onApply,
  durationMonths,
  initialCode,
}: {
  onApply: (code: string | null) => void
  durationMonths: number | null
  initialCode?: string
}) {
  const [code, setCode] = useState(initialCode ?? '')
  const [result, setResult] = useState<{ valid: boolean; discountPct?: number; freeDays?: number; reason?: string } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (initialCode) void validate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function validate() {
    if (!code.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`/api/promo/validate?code=${encodeURIComponent(code)}`)
      const data = await res.json()
      if (data.valid) {
        const freeDays = calculateFreeDays(durationMonths, data.discountPct)
        setResult({ valid: true, discountPct: data.discountPct, freeDays })
        onApply(code.toUpperCase())
      } else {
        setResult({ valid: false, reason: data.reason ?? 'Invalid code' })
        onApply(null)
      }
    } catch {
      setResult({ valid: false, reason: 'Validation failed' })
      onApply(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          label="Promo code"
          placeholder="Enter promo code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') void validate()
          }}
          disabled={loading}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => void validate()}
          disabled={loading || !code.trim()}
        >
          {loading ? 'Checking…' : 'Apply'}
        </Button>
      </div>
      {result ? (
        <p
          role={result.valid ? 'status' : 'alert'}
          className={`text-xs ${result.valid ? 'text-green-600' : 'text-red-500'}`}
        >
          {result.valid
            ? `✓ ${code.toUpperCase()} — ${result.discountPct}% off${result.freeDays ? ` / ${result.freeDays} free days` : ''}`
            : result.reason}
        </p>
      ) : null}
    </div>
  )
}
