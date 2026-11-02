import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { EmailOtpType } from '@supabase/supabase-js'
import { getClient, getSyncConfig, syncNow } from './sync'
import { authProblemText, parseLogin } from './authForm'
import { takeAuthReturn, type AuthReturn } from './authReturn'
import { db } from '../db'
import { showToast } from '../components/Toast'
import { displayName } from './actor'

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
  /** Back from an invite or reset link: a new password comes first. */
  setPassword: boolean
  /** That link was an invite (else a password reset). */
  invited: boolean
  /** Why an email link didn't work (shown on Sign in). */
  linkError: string
  email: string
  role: Role
  /** Set once the person has chosen them (Settings › Your name). */
  username: string
  fullName: string
}

/** The name stamped on your changes: full name, else @username, else the email's first part. */
export function actorName(p: { full_name?: string | null; username?: string | null; email?: string | null }): string {
  return displayName(p) || (p.email ?? '').split('@')[0]
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

/**
 * Create an account; the name and username go with it (the server keeps them
 * if they are free). Returns true when the account is signed in at once (no
 * email to confirm), false when an email link must be opened first.
 */
export async function signUpWithPassword(
  c: SupabaseClient,
  email: string,
  password: string,
  names: { username?: string; fullName?: string } = {},
): Promise<boolean> {
  const { data, error } = await c.auth.signUp({
    email: email.trim(),
    password: password.trim(),
    // Confirmation link opens this app, not Supabase's default URL.
    options: {
      emailRedirectTo: redirectUrl(),
      data: { ...(names.username ? { username: names.username } : {}), ...(names.fullName ? { full_name: names.fullName.trim() } : {}) },
    },
  })
  if (error) throw error
  return !!data.session
}

/**
 * Sign in with a username or an email. An email goes straight to Supabase; a
 * username goes through the sign-in Edge Function, which finds the email
 * without ever showing it, and hands back the session.
 */
export async function signInWithLogin(c: SupabaseClient, login: string, password: string): Promise<void> {
  const l = parseLogin(login)
  if (l.kind === 'email') return signInWithPassword(c, l.value, password)
  const cfg = getSyncConfig()
  if (!cfg) throw new Error('Cloud sync is not set up')
  const res = await fetch(`${cfg.url}/functions/v1/sign-in`, {
    method: 'POST',
    headers: { apikey: cfg.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: l.value, password: password.trim() }),
  })
  const body = (await res.json().catch(() => ({}))) as { error?: string; access_token?: string; refresh_token?: string }
  if (!res.ok || !body.access_token || !body.refresh_token) throw new Error(body.error || 'Could not sign in. Try again.')
  const { error } = await c.auth.setSession({ access_token: body.access_token, refresh_token: body.refresh_token })
  if (error) throw error
}

/** After an invite or a reset link: the new password, then the app. */
export async function setNewPassword(c: SupabaseClient, password: string): Promise<void> {
  const { error } = await c.auth.updateUser({ password: password.trim() })
  if (error) throw error
  markNeedsPassword(false)
}

const SET_PASSWORD_KEY = 'ww.setPassword'
/** 'invite' or 'recovery' while a password must be set; false when done. */
function markNeedsPassword(why: 'invite' | 'recovery' | false) {
  try {
    if (why) localStorage.setItem(SET_PASSWORD_KEY, why)
    else localStorage.removeItem(SET_PASSWORD_KEY)
  } catch {
    // private mode
  }
}
const needsPassword = (): string => {
  try {
    return localStorage.getItem(SET_PASSWORD_KEY) ?? ''
  } catch {
    return ''
  }
}

/** The email link being finished (shared by every run of the sign-in check until one shows it). */
let linkWork: Promise<string> | null = null

/** Finish an email link (main.tsx kept it): sign in from it. Returns a message when it didn't work. */
async function finishAuthReturn(c: SupabaseClient, ret: AuthReturn): Promise<string> {
  try {
    if (ret.kind === 'error') return ret.message
    let type = ''
    if (ret.kind === 'code') {
      const { data, error } = await c.auth.exchangeCodeForSession(ret.code)
      if (error) throw error
      type = (data as { redirectType?: string | null }).redirectType ?? ''
      if (!type && localStorage.getItem(RECOVERY_KEY) === '1') type = 'recovery'
    } else if (ret.kind === 'tokens') {
      const { error } = await c.auth.setSession({ access_token: ret.accessToken, refresh_token: ret.refreshToken })
      if (error) throw error
      type = ret.type
    } else {
      const { error } = await c.auth.verifyOtp({ token_hash: ret.tokenHash, type: ret.type as EmailOtpType })
      if (error) throw error
      type = ret.type
    }
    localStorage.removeItem(RECOVERY_KEY)
    if (type === 'invite' || type === 'recovery') markNeedsPassword(type)
    return ''
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // a PKCE link opened in another browser than the one that asked for it
    if (/code verifier/i.test(msg)) return 'Open the link on the phone and browser where you asked for it, or ask for a new one.'
    return authProblemText(err)
  }
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
  username?: string | null
  full_name?: string | null
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
  const [state, setState] = useState<AuthState>({
    phase: 'loading',
    session: null,
    setPassword: false,
    invited: false,
    linkError: '',
    email: '',
    role: 'viewer',
    username: '',
    fullName: '',
  })
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let alive = true
    let unsub: (() => void) | undefined
    const load = async () => {
      const c = await getClient()
      if (!c) {
        if (alive) setState({ phase: 'local', session: null, setPassword: false, invited: false, linkError: '', email: '', role: 'admin', username: '', fullName: '' })
        return
      }
      // An email link is finished once, even when this runs twice (React dev, a quick refresh).
      if (!linkWork) {
        const ret = takeAuthReturn()
        if (ret) linkWork = finishAuthReturn(c, ret)
      }
      const linkError = linkWork ? await linkWork : ''
      const { data } = await c.auth.getSession()
      const session = data.session
      type Profile = { status: AccessStatus; role: Role; username?: string | null; full_name?: string | null }
      let profile: Profile | null = null
      if (session && navigator.onLine) {
        const q = (cols: string) => c.from('profiles').select(cols).eq('id', session.user.id).maybeSingle()
        let res = await q('status, role, username, full_name')
        // a server without the name columns yet: never fall back to "viewer" over it
        if (res.error?.code === '42703') res = await q('status, role')
        const p = res.data as Profile | null
        if (p) {
          profile = p
          try {
            localStorage.setItem(ACCESS_KEY, JSON.stringify({ uid: session.user.id, ...profile }))
          } catch {
            // private mode
          }
        }
      }
      const cached = session ? readCache(session.user.id) : null
      const r = resolvePhase(true, session, profile, cached)
      const names = profile ?? cached
      if (alive) linkWork = null
      if (alive)
        setState((prev) => ({
          phase: r.phase,
          session,
          setPassword: !!session && !!needsPassword(),
          invited: needsPassword() === 'invite',
          linkError: linkError || (session ? '' : prev.linkError),
          email: session?.user.email ?? '',
          role: r.role,
          username: names?.username ?? '',
          fullName: names?.full_name ?? '',
        }))
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
    // Changes are stamped by the account that sends them: send them before leaving.
    const unsent = await db.activity
      .filter((a) => !a.synced)
      .count()
      .catch(() => 0)
    if (unsent > 0 && navigator.onLine) await syncNow().catch(() => {})
    else if (unsent > 0) {
      showToast({ text: `${unsent} change${unsent === 1 ? '' : 's'} not sent yet. Connect to the internet, then sign out.`, tone: 'bad', duration: 8000 })
      return
    }
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
  /** '' in local-only mode. */
  userId: string
  username: string
  fullName: string
  /** Reload the profile (after changing your name). */
  refresh: () => void
}

/** Who is signed in, for the sidebar and admin pages. */
export const AuthContext = createContext<AuthInfo>({
  email: '',
  role: 'viewer',
  canEdit: false,
  signOut: async () => {},
  userId: '',
  username: '',
  fullName: '',
  refresh: () => {},
})
export const useAuthInfo = () => useContext(AuthContext)
