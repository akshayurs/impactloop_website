import { adminDb } from '@/lib/server/firebase-admin'
import { requireUser, UnauthorizedError } from '@/lib/server/verify-token'

export const runtime = 'nodejs'

export async function GET(req: Request): Promise<Response> {
  let uid: string
  try {
    ;({ uid } = await requireUser(req))
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'unauthorized' }, { status: 401 })
    throw err
  }

  try {
    const db = adminDb()
    const appRefs = await db.collection(`users/${uid}/apps`).listDocuments()
    const apps = await Promise.all(
      appRefs.map(async (ref) => {
        const snap = await ref.get()
        const data = snap.exists ? snap.data() : undefined
        return { appId: ref.id, subscription: data?.subscription ?? null, entitlements: data?.entitlements ?? null }
      }),
    )
    const paymentsSnap = await db
      .collection(`users/${uid}/payments`)
      .orderBy('createdAt', 'desc')
      .orderBy('__name__', 'desc')
      .limit(20)
      .get()
    const payments = paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    const last = paymentsSnap.docs[paymentsSnap.docs.length - 1]
    const paymentsCursor = paymentsSnap.docs.length === 20 && last ? `${last.data().createdAt}_${last.id}` : null
    return Response.json({ apps, payments, paymentsCursor })
  } catch (err) {
    console.error('summary failed', err)
    return Response.json({ error: 'summary failed' }, { status: 500 })
  }
}
