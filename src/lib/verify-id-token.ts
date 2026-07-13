import { adminAuth } from './firebase-admin'

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

/**
 * Verifies the Firebase ID token on a route handler's incoming Request.
 * Throws `UnauthorizedError` (map to HTTP 401) if the header is missing/malformed
 * or the token fails verification.
 */
export async function verifyIdToken(req: Request): Promise<{ uid: string }> {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header')
  }

  const token = header.slice('Bearer '.length).trim()
  if (!token) {
    throw new UnauthorizedError('Missing bearer token')
  }

  try {
    const decoded = await adminAuth().verifyIdToken(token)
    return { uid: decoded.uid }
  } catch {
    throw new UnauthorizedError('Invalid or expired ID token')
  }
}
