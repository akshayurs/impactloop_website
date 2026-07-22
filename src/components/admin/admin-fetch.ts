import type { User } from 'firebase/auth'
import { mockResponse } from '@/lib/mock'

export async function adminFetch(user: User, path: string, init?: RequestInit): Promise<Response> {
  const mock = mockResponse(path, init)
  if (mock) return mock
  const token = await user.getIdToken()
  return fetch(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
}
