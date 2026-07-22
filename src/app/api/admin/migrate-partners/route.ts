import { DEFAULT_APP_ID } from '@/config/apps'
import { adminDb } from '@/lib/server/firebase-admin'
import { DEFAULT_PARTNER_CONFIG } from '@/lib/server/partner-config'
import { withAdmin } from '../_lib'

export const runtime = 'nodejs'

/**
 * One-off, idempotent migration of the legacy GLOBAL partner data into the per-app model,
 * assigning everything to the default app (CrackLoop). Safe to re-run.
 *
 * - influencers/{uid} (legacy shape) -> influencerApps/{uid}_crackloop + slim identity
 * - promoCodes/{code}               -> add appId
 * - referrals/{id}                  -> add appId
 * - partnerConfig/{crackloop}       -> seed default discount
 *
 * Requires body { confirm: true }.
 */
export async function POST(req: Request): Promise<Response> {
  return withAdmin(req, async () => {
    const body = await req.json().catch(() => ({}))
    if (body?.confirm !== true) {
      return Response.json({ error: 'pass { confirm: true } to run the migration' }, { status: 400 })
    }
    const db = adminDb()
    const appId = DEFAULT_APP_ID
    const result = { enrollments: 0, identities: 0, promoCodes: 0, referrals: 0 }

    const influencers = await db.collection('influencers').get()
    for (const doc of influencers.docs) {
      const data = doc.data() as Record<string, unknown>
      // Legacy docs carry `status`; already-migrated identity docs do not.
      if (typeof data.status === 'string') {
        const enrollmentRef = db.doc(`influencerApps/${doc.id}_${appId}`)
        if (!(await enrollmentRef.get()).exists) {
          await enrollmentRef.set({
            uid: doc.id,
            appId,
            status: data.status,
            appliedAt: data.appliedAt ?? Date.now(),
            decidedAt: data.decidedAt ?? null,
            promoCode: data.promoCode ?? null,
            commissionRates: data.commissionRates ?? { signupPaise: 0, perPlan: {} },
          })
          result.enrollments++
        }
        await db.doc(`influencers/${doc.id}`).set(
          { socialLinks: data.socialLinks ?? [], appliedAt: data.appliedAt ?? Date.now() },
          { merge: false },
        )
        result.identities++
      }
    }

    const promoCodes = await db.collection('promoCodes').get()
    for (const doc of promoCodes.docs) {
      if (!doc.data().appId) {
        await doc.ref.set({ appId }, { merge: true })
        result.promoCodes++
      }
    }

    const referrals = await db.collection('referrals').get()
    for (const doc of referrals.docs) {
      if (!doc.data().appId) {
        await doc.ref.set({ appId }, { merge: true })
        result.referrals++
      }
    }

    const configRef = db.doc(`partnerConfig/${appId}`)
    if (!(await configRef.get()).exists) await configRef.set(DEFAULT_PARTNER_CONFIG)

    return Response.json({ ok: true, appId, migrated: result })
  })
}
