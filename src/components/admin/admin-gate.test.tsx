import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockAuth } = vi.hoisted(() => ({ mockAuth: { user: null as any, loading: false, signIn: vi.fn(), signOut: vi.fn() } }))
vi.mock('@/lib/auth-context', () => ({ useAuth: () => mockAuth }))

import { AdminGate } from './admin-gate'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AdminGate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('prompts sign-in when signed out', () => {
    mockAuth.user = null
    render(<AdminGate>secret</AdminGate>)
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
  })

  it('renders children for admin', async () => {
    mockAuth.user = { getIdToken: vi.fn().mockResolvedValue('t') }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
    render(<AdminGate>secret</AdminGate>)
    await waitFor(() => expect(screen.getByText('secret')).toBeInTheDocument())
  })

  it('shows not-authorized on 403', async () => {
    mockAuth.user = { getIdToken: vi.fn().mockResolvedValue('t') }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 403 })))
    render(<AdminGate>secret</AdminGate>)
    await waitFor(() => expect(screen.getByText(/not authorized/i)).toBeInTheDocument())
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
  })
})
