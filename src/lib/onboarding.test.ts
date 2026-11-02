import { describe, expect, it } from 'vitest'
import { onboardingSteps, type OnboardingState } from './onboarding'

const base: OnboardingState = {
  role: 'editor',
  cloud: true,
  mobile: true,
  installed: false,
  hasName: false,
  synced: false,
  seen: [],
  teamSize: 1,
}

describe('Get started: what to do next', () => {
  it('an editor on a phone: install, name, data, tickets, KPIs, in that order', () => {
    const r = onboardingSteps(base)
    expect(r.steps.map((s) => s.id)).toEqual(['install', 'name', 'data', 'hold', 'kpi'])
    expect(r.next?.id).toBe('install')
    expect(r.doneCount).toBe(0)
    expect(r.allDone).toBe(false)
  })
  it('each step is done by doing it, not by ticking it', () => {
    const r = onboardingSteps({ ...base, installed: true, hasName: true, synced: true, seen: ['hold'] })
    expect(r.doneCount).toBe(4)
    expect(r.next?.id).toBe('kpi')
  })
  it('a viewer is shown the Dashboard instead of entering data', () => {
    const ids = onboardingSteps({ ...base, role: 'viewer' }).steps.map((s) => s.id)
    expect(ids).toContain('dashboard')
    expect(ids).not.toContain('kpi')
    expect(ids).not.toContain('hold')
  })
  it('the admin also invites the team (done once someone else is in)', () => {
    const admin = { ...base, role: 'admin' as const }
    expect(onboardingSteps(admin).steps.map((s) => s.id)).toContain('invite')
    expect(onboardingSteps({ ...admin, teamSize: 2 }).steps.find((s) => s.id === 'invite')?.done).toBe(true)
  })
  it('no install step on a computer; no name or data steps without a cloud account', () => {
    expect(onboardingSteps({ ...base, mobile: false }).steps.map((s) => s.id)).not.toContain('install')
    const local = onboardingSteps({ ...base, cloud: false }).steps.map((s) => s.id)
    expect(local).not.toContain('name')
    expect(local).not.toContain('data')
  })
  it('all done', () => {
    const r = onboardingSteps({ ...base, installed: true, hasName: true, synced: true, seen: ['hold', 'kpi'] })
    expect(r.allDone).toBe(true)
    expect(r.next).toBeUndefined()
  })
})
