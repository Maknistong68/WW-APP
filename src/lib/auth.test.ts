import { describe, expect, it } from 'vitest'
import { canEditRole, normRole, resolvePhase } from './auth'
import type { Session } from '@supabase/supabase-js'

const s = { user: { id: 'u' } } as Session

describe('sign-in gate', () => {
  it('no cloud project = local mode; no session = login', () => {
    expect(resolvePhase(false, null, null, null).phase).toBe('local')
    expect(resolvePhase(true, null, null, null).phase).toBe('signedOut')
  })
  it('profile decides; offline falls back to the remembered status', () => {
    expect(resolvePhase(true, s, { status: 'pending', role: 'editor' }, null).phase).toBe('pending')
    expect(resolvePhase(true, s, { status: 'approved', role: 'admin' }, null)).toEqual({ phase: 'approved', role: 'admin' })
    expect(resolvePhase(true, s, null, { uid: 'u', status: 'rejected', role: 'editor' }).phase).toBe('rejected')
    expect(resolvePhase(true, s, null, null)).toEqual({ phase: 'approved', role: 'viewer' })
  })
  it('roles: old "member" can edit, viewers cannot', () => {
    expect(normRole('member')).toBe('editor')
    expect(normRole('viewer')).toBe('viewer')
    expect(normRole(undefined)).toBe('viewer')
    expect(resolvePhase(true, s, { status: 'approved', role: 'member' as never }, null).role).toBe('editor')
    expect(canEditRole('admin')).toBe(true)
    expect(canEditRole('editor')).toBe(true)
    expect(canEditRole('viewer')).toBe(false)
  })
})
