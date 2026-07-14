import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ThemeProvider } from './theme-provider'
import { Nav } from './nav'

describe('Nav', () => {
  it('has links to apps and pricing', () => {
    render(
      <ThemeProvider>
        <Nav />
      </ThemeProvider>,
    )
    expect(screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/pricing')
  })
  it('mobile menu is hidden until toggled and uses aria-expanded', () => {
    render(
      <ThemeProvider>
        <Nav />
      </ThemeProvider>,
    )
    const toggle = screen.getAllByRole('button', { name: /menu/i })[0]
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })
})
