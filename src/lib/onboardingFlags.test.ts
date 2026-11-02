import { describe, expect, it, vi } from 'vitest'

// A tiny localStorage for the node test runner.
const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
})

describe('Get started progress is kept on the phone', () => {
  it('also on a phone with no cloud account (the "local" person)', async () => {
    store.set('ww.onboarding.local', JSON.stringify({ hidden: true, seen: ['hold'] }))
    const { getOnboardingFlags, setOnboardingUser } = await import('./onboarding')
    setOnboardingUser('')
    expect(getOnboardingFlags()).toEqual({ hidden: true, seen: ['hold'] })
  })
  it('each signed-in person has their own', async () => {
    store.set('ww.onboarding.u1', JSON.stringify({ hidden: false, seen: ['kpi'] }))
    const { getOnboardingFlags, markSeen, setOnboardingUser } = await import('./onboarding')
    setOnboardingUser('u1')
    expect(getOnboardingFlags().seen).toEqual(['kpi'])
    markSeen('dashboard')
    expect(JSON.parse(store.get('ww.onboarding.u1')!).seen).toEqual(['kpi', 'dashboard'])
    setOnboardingUser('')
    expect(getOnboardingFlags().seen).toEqual(['hold'])
  })
})
