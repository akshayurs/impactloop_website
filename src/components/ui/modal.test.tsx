import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmModal } from './modal'

describe('ConfirmModal', () => {
  it('renders nothing when closed', () => {
    render(
      <ConfirmModal open={false} title="Cancel plan?" body="x" confirmLabel="Cancel plan" onConfirm={() => {}} onClose={() => {}} />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('fires onConfirm and onClose', () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(
      <ConfirmModal open title="Cancel plan?" body="Are you sure" confirmLabel="Yes, cancel" onConfirm={onConfirm} onClose={onClose} destructive />,
    )
    expect(screen.getByRole('dialog', { name: 'Cancel plan?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel' }))
    expect(onConfirm).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    expect(onClose).toHaveBeenCalled()
  })
})
