import { isOptOutCategory, setEmailPref, verifyUnsubToken } from '@/lib/server/email/prefs'

export const runtime = 'nodejs'

function parse(req: Request): { u: string; c: string; t: string } {
  const p = new URL(req.url).searchParams
  return { u: p.get('u') ?? '', c: p.get('c') ?? '', t: p.get('t') ?? '' }
}

// RFC 8058 one-click: Gmail/Yahoo POST here with `List-Unsubscribe=One-Click`.
export async function POST(req: Request): Promise<Response> {
  const { u, c, t } = parse(req)
  if (!isOptOutCategory(c) || !verifyUnsubToken(u, c, t)) {
    return Response.json({ error: 'invalid link' }, { status: 400 })
  }
  await setEmailPref(u, c, false)
  return new Response(null, { status: 200 })
}

// A human clicking the header link lands here via GET — send them to the confirm page,
// never mutating on GET (link scanners/prefetchers must not change preferences).
export function GET(req: Request): Response {
  const { u, c, t } = parse(req)
  const params = new URLSearchParams({ u, c, t })
  return Response.redirect(new URL(`/unsubscribe?${params}`, req.url), 302)
}
