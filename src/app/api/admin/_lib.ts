import { ForbiddenError, requireAdmin } from '@/lib/server/require-admin'
import { UnauthorizedError } from '@/lib/server/verify-token'

export async function withAdmin(req: Request, fn: () => Promise<Response>): Promise<Response> {
  try {
    await requireAdmin(req)
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'unauthorized' }, { status: 401 })
    if (err instanceof ForbiddenError) return Response.json({ error: 'forbidden' }, { status: 403 })
    throw err
  }
  try {
    return await fn()
  } catch (err) {
    console.error('admin api failed', err)
    return Response.json({ error: 'internal error' }, { status: 500 })
  }
}
