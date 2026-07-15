import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const signIn = vi.fn()
let mockUser: any = null
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: mockUser, loading: false, signIn, signOut: vi.fn() }),
}))

import type { Plan } from '@/config/plans'
import { CheckoutButton } from './checkout-button'

const plan: Plan = { id: 'p1', appId: 'crackloop', tier: 'pro', durationMonths: 1, lifetime: false, pricePaise: 7900, playStorePricePaise: 9900, active: true, sort: 1 }

afterEach(cleanup)

describe('CheckoutButton', () => {
  beforeEach(() => vi.clearAllMocks())

  it('prompts sign-in when signed out', () => {
    mockUser = null
    render(<CheckoutButton plan={plan} />)
    fireEvent.click(screen.getByRole('button', { name: /sign in to subscribe/i }))
    expect(signIn).toHaveBeenCalled()
  })

  it('shows API error to the user', async () => {
    mockUser = { getIdToken: vi.fn().mockResolvedValue('tok') }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'subscription already active' }), { status: 409 })))
    render(<CheckoutButton plan={plan} />)
    fireEvent.click(screen.getByRole('button', { name: /subscribe/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/already have an active plan/i))
    vi.unstubAllGlobals()
  })

  it('sends bearer token and planId to checkout api', async () => {
    mockUser = { getIdToken: vi.fn().mockResolvedValue('tok') }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'x' }), { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<CheckoutButton plan={plan} />)
    fireEvent.click(screen.getByRole('button', { name: /subscribe/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/checkout')
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body)).toEqual({ planId: 'p1' })
    vi.unstubAllGlobals()
  })
})
