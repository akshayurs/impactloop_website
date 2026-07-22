import { adminAuth } from './firebase-admin'
import { UnauthorizedError } from './verify-token'

export class ForbiddenError extends Error {
  status = 403
}

export async function requireAdmin(req: Request): Promise<{ uid: string; email: string | null }> {
  const header = req.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) throw new UnauthorizedError('missing bearer token')
  let decoded: { uid: string; email?: string; admin?: unknown }
  try {
    // checkRevoked: a disabled/revoked admin loses access immediately, not after token TTL.
    decoded = await adminAuth().verifyIdToken(header.slice('Bearer '.length), true)
  } catch {
    throw new UnauthorizedError('invalid token')
  }
  if (decoded.admin !== true) throw new ForbiddenError('admin only')
  return { uid: decoded.uid, email: decoded.email ?? null }
}
