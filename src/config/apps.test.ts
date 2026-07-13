import { describe, it, expect } from 'vitest'
import { APPS, getApp, listApps } from './apps'

describe('app registry', () => {
  it('contains the crackloop entry with required fields', () => {
    const e = getApp('crackloop')
    expect(e).toBeDefined()
    expect(e!.displayName).toBe('CrackLoop')
    expect(e!.playProductIds.pro).toMatch(/pro/)
  })
  it('returns undefined for unknown appId', () => {
    expect(getApp('nope')).toBeUndefined()
  })
  it('listApps returns all entries', () => {
    expect(listApps().length).toBe(Object.keys(APPS).length)
    expect(listApps().every((a) => a.appId && a.displayName)).toBe(true)
  })
})
