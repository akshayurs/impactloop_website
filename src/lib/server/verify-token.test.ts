import { describe, expect, it, vi } from 'vitest'

const verifyIdToken = vi.fn()
vi.mock('./firebase-admin', () => ({
  adminAuth: () => ({ verifyIdToken }),
}))

import { requireUser, UnauthorizedError } from './verify-token'

describe('requireUser', () => {

  it('rejects missing Authorization header', async () => {
    const req = new Request('http://x', { method: 'POST' })
    await expect(requireUser(req)).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('rejects non-Bearer header', async () => {
    const req = new Request('http://x', { headers: { Authorization: 'Basic abc' } })
    await expect(requireUser(req)).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('rejects when token verification fails', async () => {
    verifyIdToken.mockImplementation(() => Promise.reject(new Error('bad token')))
    const req = new Request('http://x', { headers: { Authorization: 'Bearer tok' } })
    const err = await requireUser(req).then(
      () => null,
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(UnauthorizedError)
  })

  it('returns uid and email on valid token', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.c' })
    const req = new Request('http://x', { headers: { Authorization: 'Bearer tok' } })
    await expect(requireUser(req)).resolves.toEqual({ uid: 'u1', email: 'a@b.c' })
  })

  it('normalizes missing email to null', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1' })
    const req = new Request('http://x', { headers: { Authorization: 'Bearer tok' } })
    await expect(requireUser(req)).resolves.toEqual({ uid: 'u1', email: null })
  })
})
