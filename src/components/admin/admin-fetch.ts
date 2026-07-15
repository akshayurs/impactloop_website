import type { User } from 'firebase/auth'

export async function adminFetch(user: User, path: string, init?: RequestInit): Promise<Response> {
  const token = await user.getIdToken()
  return fetch(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
}
