import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/auth-context'
import { ThemeProvider } from './theme-provider'
import { Nav } from './nav'

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/firebase/client', () => ({ getFirebaseAuth: () => ({}) }))
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(),
  onAuthStateChanged: (_auth: unknown, cb: (user: null) => void) => {
    cb(null)
    return () => {}
  },
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}))

afterEach(cleanup)

describe('Nav', () => {
  it('has links to apps and pricing', () => {
    render(
      <ThemeProvider>
        <AuthProvider>
          <Nav />
        </AuthProvider>
      </ThemeProvider>,
    )
    expect(screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/pricing')
  })
  it('mobile menu is hidden until toggled and uses aria-expanded', () => {
    render(
      <ThemeProvider>
        <AuthProvider>
          <Nav />
        </AuthProvider>
      </ThemeProvider>,
    )
    const toggle = screen.getByRole('button', { name: /menu/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })
})
