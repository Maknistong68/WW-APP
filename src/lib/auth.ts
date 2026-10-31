import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { getClient } from './sync'

// Sign-in gate: the app opens on Login, new accounts wait for the admin's
// approval, approved users share the team's data (enforced by RLS).

export const RECOVERY_KEY = 'ww.passwordRecovery'
const ACCESS_KEY = 'ww.access'

export type AccessStatus = 'pending' | 'approved' | 'rejected'
export type Role = 'admin' | 'editor' | 'viewer'

export const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' }

/** Older profiles said "member" (= could edit). Anything unknown is read-only. */
export function normRole(r: unknown): Role {
  if (r === 'admin' || r === 'editor' || r === 'viewer') return r
  return r === 'member' ? 'editor' : 'viewer'
}

/** Admins and editors add and change data; viewers only look. */
export const canEditRole = (r: Role) => r !== 'viewer'

export type AuthPhase = 'loading' | 'local' | 'signedOut' | AccessStatus

export interface AuthState {
  phase: AuthPhase
  session: Session | null
  email: string
  role: Role
}

const redirectUrl = () => `${window.location.origin}${window.location.pathname}`

export function authErrorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/invalid login credentials/i.test(msg)) {
    return 'Wrong email or password. Tap 👁 to check what is typed, or use "Forgot password".'
  }
  if (/email not confirmed/i.test(msg)) return 'Confirm your email first — open the link Supabase sent you.'
  return msg
}

export async function signInWithPassword(c: SupabaseClient, email: string, password: string) {
  const { error } = await c.auth.signInWithPassword({ email: email.trim(), password: password.trim() })
  if (error) throw error
}

export async function signUpWithPassword(c: SupabaseClient, email: string, password: string) {
  const { error } = await c.auth.signUp({
    email: email.trim(),
    password: password.trim(),
    // Confirmation link opens this app, not Supabase's default URL.
    options: { emailRedirectTo: redirectUrl() },
  })
  if (error) throw error
}

export async function sendPasswordReset(c: SupabaseClient, email: string) {
  if (!email.trim()) throw new Error('Type your email first, then tap Forgot password')
  const { error } = await c.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectUrl() })
  if (error) throw error
  localStorage.setItem(RECOVERY_KEY, '1')
}

interface CachedAccess {
  uid: string
  status: AccessStatus
  role: Role
}

function readCache(uid: string): CachedAccess | null {
  try {
    const c = JSON.parse(localStorage.getItem(ACCESS_KEY) ?? 'null') as CachedAccess | null
    return c && c.uid === uid ? c : null
  } catch {
    return null
  }
}

/**
 * Decide what the app shows. Offline with a remembered approval → the app
 * still opens; the server keeps protecting the data either way.
 */
export function resolvePhase(
  hasCloud: boolean,
  session: Session | null,
  profile: { status: AccessStatus; role: Role } | null,
  cached: CachedAccess | null,
): { phase: AuthPhase; role: Role } {
  if (!hasCloud) return { phase: 'local', role: 'admin' }
  if (!session) return { phase: 'signedOut', role: 'viewer' }
  if (profile) return { phase: profile.status, role: normRole(profile.role) }
  if (cached) return { phase: cached.status, role: normRole(cached.role) }
  // Signed in but the profile can't be read (offline): let them in; nothing
  // syncs without approval because the server refuses it.
  return { phase: 'approved', role: 'viewer' }
}

export function useAuth(): AuthState & { refresh: () => void; signOut: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({ phase: 'loading', session: null, email: '', role: 'viewer' })
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let alive = true
    let unsub: (() => void) | undefined
    const load = async () => {
      const c = await getClient()
      if (!c) {
        if (alive) setState({ phase: 'local', session: null, email: '', role: 'admin' })
        return
      }
      const { data } = await c.auth.getSession()
      const session = data.session
      let profile: { status: AccessStatus; role: Role } | null = null
      if (session && navigator.onLine) {
        const { data: p } = await c.from('profiles').select('status, role').eq('id', session.user.id).maybeSingle()
        if (p) {
          profile = p as { status: AccessStatus; role: Role }
          try {
            localStorage.setItem(ACCESS_KEY, JSON.stringify({ uid: session.user.id, ...profile }))
          } catch {
            // private mode
          }
        }
      }
      const r = resolvePhase(true, session, profile, session ? readCache(session.user.id) : null)
      if (alive) setState({ phase: r.phase, session, email: session?.user.email ?? '', role: r.role })
      if (!unsub) {
        const { data: sub } = c.auth.onAuthStateChange((e) => {
          if (e === 'SIGNED_IN' || e === 'SIGNED_OUT' || e === 'USER_UPDATED') setTick((t) => t + 1)
        })
        unsub = () => sub.subscription.unsubscribe()
      }
    }
    void load()
    // Approval may arrive while the app is open in the background.
    const onVisible = () => document.visibilityState === 'visible' && setTick((t) => t + 1)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      unsub?.()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [tick])

  const signOut = useCallback(async () => {
    const c = await getClient()
    await c?.auth.signOut()
    setTick((t) => t + 1)
  }, [])

  return { ...state, refresh, signOut }
}


export interface AuthInfo {
  email: string
  role: Role
  /** Admin or editor. */
  canEdit: boolean
  signOut: () => Promise<void>
}

/** Who is signed in, for the sidebar and admin pages. */
export const AuthContext = createContext<AuthInfo>({ email: '', role: 'viewer', canEdit: false, signOut: async () => {} })
export const useAuthInfo = () => useContext(AuthContext)
