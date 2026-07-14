import { describe, expect, it } from 'vitest'
import { APPS, getApp } from './apps'

describe('app registry', () => {
  it('contains crackloop as a live app with play store url', () => {
    const app = getApp('crackloop')
    expect(app).toBeDefined()
    expect(app!.status).toBe('live')
    expect(app!.playStoreUrl).toBe('https://play.google.com/store/apps/details?id=com.impactloop.crackloop')
  })
  it('returns undefined for unknown app', () => {
    expect(getApp('nope')).toBeUndefined()
  })
  it('every app has non-empty features', () => {
    for (const app of APPS) expect(app.features.length).toBeGreaterThan(0)
  })
})
