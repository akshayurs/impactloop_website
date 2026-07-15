import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: null, loading: false, signIn: vi.fn(), signOut: vi.fn() }),
}))

import type { Plan } from '@/config/plans'
import { PlanCard, durationLabel } from './plan-card'

afterEach(() => cleanup())

const plan: Plan = {
  id: 'p1',
  appId: 'crackloop',
  tier: 'pro',
  durationMonths: 12,
  lifetime: false,
  pricePaise: 79900,
  playStorePricePaise: 99900,
  active: true,
  sort: 1,
}

describe('durationLabel', () => {
  it('labels durations and lifetime', () => {
    expect(durationLabel(plan)).toBe('12 months')
    expect(durationLabel({ ...plan, durationMonths: 1 })).toBe('1 month')
    expect(durationLabel({ ...plan, durationMonths: null, lifetime: true })).toBe('Lifetime')
  })
})

describe('PlanCard', () => {
  it('shows web price and struck-through play store price', () => {
    render(<PlanCard plan={plan} />)
    expect(screen.getByText('₹799')).toBeInTheDocument()
    const struck = screen.getByText('₹999')
    expect(struck.tagName).toBe('S')
  })
})
