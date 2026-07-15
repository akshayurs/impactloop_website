import { beforeEach, describe, expect, it, vi } from 'vitest'

const { docSet, collGet } = vi.hoisted(() => ({ docSet: vi.fn(), collGet: vi.fn() }))
vi.mock('./firebase-admin', () => ({
  adminDb: () => ({
    doc: (path: string) => ({ set: (d: unknown) => docSet(path, d) }),
    collection: () => ({ where: () => ({ get: collGet }), get: collGet }),
  }),
}))

import { STATIC_TIERS } from '@/config/tiers'
import { getTiersFromDb, upsertTier } from './tiers-store'

const valid = {
  appId: 'crackloop',
  tier: 'pro' as const,
  title: 'Pro',
  blurb: 'Everything, ad-free.',
  benefits: ['One', 'Two'],
  offerName: 'Launch offer',
  compareLabel: 'vs Google Play',
  highlight: true,
  sort: 1,
}

describe('upsertTier', () => {
  beforeEach(() => vi.clearAllMocks())

  it('writes a normalized doc with derived id', async () => {
    const doc = await upsertTier({ ...valid, title: ' Pro ' })
    expect(doc.id).toBe('crackloop_pro')
    expect(doc.title).toBe('Pro')
    expect(docSet).toHaveBeenCalledWith('tiers/crackloop_pro', doc)
  })

  it('rejects missing title, empty benefits, bad types', async () => {
    await expect(upsertTier({ ...valid, title: '' })).rejects.toThrow(/title/)
    await expect(upsertTier({ ...valid, benefits: [] })).rejects.toThrow(/benefits/)
    await expect(upsertTier({ ...valid, highlight: 'yes' as never })).rejects.toThrow(/highlight/)
    await expect(upsertTier({ ...valid, sort: 1.5 })).rejects.toThrow(/sort/)
    expect(docSet).not.toHaveBeenCalled()
  })
})

describe('getTiersFromDb', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT', '{}')
  })

  it('falls back to static tiers when collection empty', async () => {
    collGet.mockResolvedValue({ empty: true, docs: [] })
    expect(await getTiersFromDb('crackloop')).toEqual(STATIC_TIERS)
  })

  it('returns db docs sorted', async () => {
    collGet.mockResolvedValue({
      empty: false,
      docs: [
        { data: () => ({ id: 'b', sort: 2 }) },
        { data: () => ({ id: 'a', sort: 1 }) },
      ],
    })
    const tiers = await getTiersFromDb('crackloop')
    expect(tiers.map((t) => t.id)).toEqual(['a', 'b'])
  })
})
