import { adminDb } from '@/lib/server/firebase-admin'
import { requireUser, UnauthorizedError } from '@/lib/server/verify-token'

export const runtime = 'nodejs'

export async function GET(req: Request, { params }: { params: Promise<{ paymentId: string }> }): Promise<Response> {
  let uid: string
  let email: string | null
  try {
    ;({ uid, email } = await requireUser(req))
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'unauthorized' }, { status: 401 })
    throw err
  }
  const { paymentId } = await params
  const snap = await adminDb().doc(`users/${uid}/payments/${paymentId}`).get()
  if (!snap.exists) return Response.json({ error: 'not found' }, { status: 404 })
  const d = snap.data() ?? {}
  return Response.json({
    paymentId,
    email,
    amountPaise: typeof d.amountPaise === 'number' ? d.amountPaise : null,
    planId: d.planId ?? null,
    appId: d.appId ?? null,
    type: d.type ?? null,
    createdAt: typeof d.createdAt === 'number' ? d.createdAt : null,
  })
}
