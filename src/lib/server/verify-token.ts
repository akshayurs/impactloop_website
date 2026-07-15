import { adminAuth } from './firebase-admin'

export class UnauthorizedError extends Error {
  status = 401
}

export async function requireUser(req: Request): Promise<{ uid: string; email: string | null }> {
  const header = req.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) throw new UnauthorizedError('missing bearer token')
  const token = header.slice('Bearer '.length)
  try {
    const decoded = await adminAuth().verifyIdToken(token)
    return { uid: decoded.uid, email: decoded.email ?? null }
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err
    throw new UnauthorizedError('invalid token')
  }
}
