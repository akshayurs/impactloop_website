import { describe, expect, it, vi } from 'vitest'

const { verifyIdToken } = vi.hoisted(() => ({ verifyIdToken: vi.fn() }))
vi.mock('./firebase-admin', () => ({ adminAuth: () => ({ verifyIdToken }) }))

import { ForbiddenError, requireAdmin } from './require-admin'
import { UnauthorizedError } from './verify-token'

function req(auth?: string) {
  return new Request('http://x', auth ? { headers: { Authorization: auth } } : undefined)
}

describe('requireAdmin', () => {
  it('rejects missing token with UnauthorizedError', async () => {
    const err = await requireAdmin(req()).then(() => null, (e: unknown) => e)
    expect(err).toBeInstanceOf(UnauthorizedError)
  })

  it('rejects invalid token with UnauthorizedError', async () => {
    verifyIdToken.mockImplementation(() => Promise.reject(new Error('bad')))
    const err = await requireAdmin(req('Bearer t')).then(() => null, (e: unknown) => e)
    expect(err).toBeInstanceOf(UnauthorizedError)
  })

  it('rejects authenticated non-admin with ForbiddenError', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.c' })
    const err = await requireAdmin(req('Bearer t')).then(() => null, (e: unknown) => e)
    expect(err).toBeInstanceOf(ForbiddenError)
  })

  it('accepts admin claim', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.c', admin: true })
    await expect(requireAdmin(req('Bearer t'))).resolves.toEqual({ uid: 'u1', email: 'a@b.c' })
  })
})
