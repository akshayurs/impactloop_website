import { APPS } from '@/config/apps'
import { getEarnings, getInfluencer, suggestCodes } from '@/lib/server/influencer'
import { getAppCommission, listEnrollments } from '@/lib/server/influencer-apps'
import { getPartnerConfig } from '@/lib/server/partner-config'
import { getSettings } from '@/lib/server/settings'
import { requireUser, UnauthorizedError } from '@/lib/server/verify-token'

export const runtime = 'nodejs'

function appName(appId: string): string {
  return APPS.find((a) => a.id === appId)?.name ?? appId
}

export async function GET(req: Request): Promise<Response> {
  let uid: string, email: string | null
  try {
    ;({ uid, email } = await requireUser(req))
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'unauthorized' }, { status: 401 })
    throw err
  }
  try {
    const [profile, enrollments, settings] = await Promise.all([
      getInfluencer(uid),
      listEnrollments(uid),
      getSettings(),
    ])
    const liveApps = APPS.filter((a) => a.status === 'live')
    if (!profile) {
      return Response.json({
        profile: null,
        apps: [],
        availableApps: liveApps.map((a) => ({ appId: a.id, name: a.name })),
        earnings: null,
        minPayoutPaise: settings.minPayoutPaise,
      })
    }

    const handle = email?.split('@')[0] ?? null
    const apps = await Promise.all(
      enrollments.map(async (e) => {
        const approved = e.status === 'approved'
        const [config, commissionPaise] = await Promise.all([
          getPartnerConfig(e.appId),
          approved ? getAppCommission(uid, e.appId) : Promise.resolve(0),
        ])
        return {
          appId: e.appId,
          name: appName(e.appId),
          status: e.status,
          promoCode: e.promoCode,
          discountPct: config.discountPct,
          commissionRates: e.commissionRates,
          commissionPaise,
          suggestions: approved && !e.promoCode ? suggestCodes(handle, uid) : [],
        }
      }),
    )

    const anyApproved = enrollments.some((e) => e.status === 'approved')
    const earnings = anyApproved ? await getEarnings(uid) : null
    const enrolled = new Set(enrollments.map((e) => e.appId))
    const availableApps = liveApps.filter((a) => !enrolled.has(a.id)).map((a) => ({ appId: a.id, name: a.name }))

    return Response.json({ profile, apps, availableApps, earnings, minPayoutPaise: settings.minPayoutPaise })
  } catch (err) {
    console.error('influencer me failed', err)
    return Response.json({ error: 'failed' }, { status: 500 })
  }
}
