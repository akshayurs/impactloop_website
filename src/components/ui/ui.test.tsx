import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Badge } from './badge'
import { Button } from './button'
import { Card } from './card'
import { Input } from './input'

describe('Button', () => {
  afterEach(() => cleanup())
  it('renders a button by default', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })
  it('renders an anchor when href given', () => {
    render(<Button href="/pricing">Pricing</Button>)
    expect(screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/pricing')
  })
  it('renders a disabled button instead of a link when href and disabled', () => {
    render(<Button href="/pricing" disabled>Pricing</Button>)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pricing' })).toBeDisabled()
  })
})

describe('Input', () => {
  it('associates label and shows error with role=alert', () => {
    render(<Input label="Promo code" error="Invalid code" />)
    expect(screen.getByLabelText('Promo code')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid code')
  })
})

describe('Card & Badge', () => {
  it('render children', () => {
    render(
      <Card>
        <Badge tone="success">Active</Badge>
      </Card>,
    )
    expect(screen.getByText('Active')).toBeInTheDocument()
  })
})
