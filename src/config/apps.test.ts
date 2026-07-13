import { describe, it, expect } from 'vitest'
import { APPS, getApp, listApps } from './apps'

describe('app registry', () => {
  it('contains the crackloop entry with required fields', () => {
    const e = getApp('crackloop')
    expect(e).toBeDefined()
    expect(e!.displayName).toBe('CrackLoop')
    expect(e!.playProductIds.pro).toBe('pro_monthly')
  })
  it('returns undefined for unknown appId', () => {
    expect(getApp('nope')).toBeUndefined()
  })
  it('returns undefined for prototype-chain keys', () => {
    expect(getApp('__proto__')).toBeUndefined()
    expect(getApp('constructor')).toBeUndefined()
    expect(getApp('hasOwnProperty')).toBeUndefined()
  })
  it('listApps returns all entries', () => {
    expect(listApps().length).toBe(Object.keys(APPS).length)
    expect(listApps().every((a) => a.appId && a.displayName)).toBe(true)
  })
})
