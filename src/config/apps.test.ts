import { describe, it, expect } from 'vitest'
import { getApp, getAppOrNull, listAppIds } from './apps'

describe('app registry', () => {
  it('getApp returns app metadata for crackloop', () => {
    const app = getApp('crackloop')
    expect(app).toBeDefined()
    expect(app.appId).toBe('crackloop')
    expect(app.displayName).toBe('CrackLoop')
    expect(app.contentRepo).toBe('akshayurs/CrackLoopData')
  })

  it('playProductIds.pro matches /pro/ pattern', () => {
    const app = getApp('crackloop')
    expect(app.playProductIds.pro).toMatch(/pro/)
  })

  it('getAppOrNull returns null for unknown app', () => {
    const app = getAppOrNull('unknown_app')
    expect(app).toBeNull()
  })
})
