import { describe, expect, it } from 'vitest'
import { resolvePhase } from './auth'
import type { Session } from '@supabase/supabase-js'

const s = { user: { id: 'u' } } as Session

describe('sign-in gate', () => {
  it('no cloud project = local mode; no session = login', () => {
    expect(resolvePhase(false, null, null, null).phase).toBe('local')
    expect(resolvePhase(true, null, null, null).phase).toBe('signedOut')
  })
  it('profile decides; offline falls back to the remembered status', () => {
    expect(resolvePhase(true, s, { status: 'pending', role: 'member' }, null).phase).toBe('pending')
    expect(resolvePhase(true, s, { status: 'approved', role: 'admin' }, null)).toEqual({ phase: 'approved', role: 'admin' })
    expect(resolvePhase(true, s, null, { uid: 'u', status: 'rejected', role: 'member' }).phase).toBe('rejected')
    expect(resolvePhase(true, s, null, null).phase).toBe('approved')
  })
})
