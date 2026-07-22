import { adminDb } from '@/lib/server/firebase-admin'
import { ForbiddenError, requireAdmin } from '@/lib/server/require-admin'
import { UnauthorizedError } from '@/lib/server/verify-token'

/** Best-effort audit trail for mutating admin actions (actor + path + outcome). */
async function writeAudit(
  admin: { uid: string; email: string | null },
  req: Request,
  status: number,
): Promise<void> {
  try {
    const at = Date.now()
    await adminDb()
      .doc(`adminAudit/${at}-${admin.uid}`)
      .set({
        actorUid: admin.uid,
        actorEmail: admin.email,
        method: req.method,
        path: new URL(req.url).pathname,
        status,
        at,
      })
  } catch {
    // Auditing must never break the action it records.
  }
}

export async function withAdmin(req: Request, fn: () => Promise<Response>): Promise<Response> {
  let admin: { uid: string; email: string | null }
  try {
    admin = await requireAdmin(req)
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'unauthorized' }, { status: 401 })
    if (err instanceof ForbiddenError) return Response.json({ error: 'forbidden' }, { status: 403 })
    throw err
  }
  const mutating = req.method !== 'GET'
  try {
    const res = await fn()
    if (mutating) void writeAudit(admin, req, res.status)
    return res
  } catch (err) {
    console.error('admin api failed', err)
    if (mutating) void writeAudit(admin, req, 500)
    return Response.json({ error: 'internal error' }, { status: 500 })
  }
}
