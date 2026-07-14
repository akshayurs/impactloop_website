import { beforeEach, describe, expect, it, vi } from 'vitest'

let storedData: Record<string, unknown> = {}

const { docGet, docSet } = vi.hoisted(() => ({
  docGet: vi.fn(),
  docSet: vi.fn(),
}))
vi.mock('./firebase-admin', () => ({
  adminDb: () => ({ doc: () => ({ get: docGet, set: (d: unknown, o?: unknown) => docSet(d, o) }) }),
}))

import { DEFAULT_SETTINGS, getSettings, updateSettings } from './settings'

describe('settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storedData = {}
    docGet.mockImplementation(() =>
      Promise.resolve({
        exists: Object.keys(storedData).length > 0,
        data: () => (Object.keys(storedData).length > 0 ? storedData : undefined),
      })
    )
    docSet.mockImplementation((d: unknown) => {
      storedData = { ...storedData, ...(d as Record<string, unknown>) }
      return Promise.resolve()
    })
  })

  it('returns defaults when doc missing', async () => {
    await expect(getSettings()).resolves.toEqual(DEFAULT_SETTINGS)
  })

  it('merges stored fields over defaults', async () => {
    docGet.mockResolvedValue({ exists: true, data: () => ({ freeTrialEnabled: true }) })
    await expect(getSettings()).resolves.toEqual({ ...DEFAULT_SETTINGS, freeTrialEnabled: true })
  })

  it('updates valid patch with merge and returns merged', async () => {
    const res = await updateSettings({ freeTrialEnabled: true, trialDays: 30 })
    expect(docSet).toHaveBeenCalledWith({ freeTrialEnabled: true, trialDays: 30 }, { merge: true })
    expect(res).toEqual({ ...DEFAULT_SETTINGS, freeTrialEnabled: true, trialDays: 30 })
  })

  it('rejects invalid trialDays and unknown keys', async () => {
    await expect(updateSettings({ trialDays: 0 })).rejects.toThrow(/trialDays/)
    await expect(updateSettings({ trialDays: 1.5 })).rejects.toThrow(/trialDays/)
    await expect(updateSettings({ nope: 1 } as never)).rejects.toThrow(/unknown/)
    expect(docSet).not.toHaveBeenCalled()
  })
})
