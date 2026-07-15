import { adminDb } from '@/lib/server/firebase-admin'
import { parseCursor } from '@/lib/server/admin-data'
import { requireUser, UnauthorizedError } from '@/lib/server/verify-token'

export const runtime = 'nodejs'

const PAGE_SIZE = 20

export async function GET(req: Request): Promise<Response> {
  let uid: string
  try {
    ;({ uid } = await requireUser(req))
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'unauthorized' }, { status: 401 })
    throw err
  }

  try {
    const cursor = new URL(req.url).searchParams.get('cursor')
    let query = adminDb()
      .collection(`users/${uid}/payments`)
      .orderBy('createdAt', 'desc')
      .orderBy('__name__', 'desc')
      .limit(PAGE_SIZE)
    const after = parseCursor(cursor)
    if (after) query = query.startAfter(after.value, after.id)
    const snap = await query.get()
    const payments = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    const last = snap.docs[snap.docs.length - 1]
    return Response.json({
      payments,
      nextCursor: snap.docs.length === PAGE_SIZE && last ? `${last.data().createdAt}_${last.id}` : null,
    })
  } catch (err) {
    console.error('payments page failed', err)
    return Response.json({ error: 'payments failed' }, { status: 500 })
  }
}
