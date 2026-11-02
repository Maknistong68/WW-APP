// ---------------------------------------------------------------------------
// Coming back from an email link (confirm, invite, password reset). Supabase
// sends one of four shapes; the app reads it once at start (main.tsx), keeps
// it for the sign-in code (auth.ts) and tidies the address bar so the hash
// router only ever sees "#/…".
// ---------------------------------------------------------------------------

export type LinkType = 'invite' | 'recovery' | 'signup' | 'email' | 'magiclink' | 'email_change'

export type AuthReturn =
  | { kind: 'code'; code: string }
  | { kind: 'tokens'; accessToken: string; refreshToken: string; type: LinkType | string }
  | { kind: 'otp'; tokenHash: string; type: LinkType | string }
  | { kind: 'error'; message: string }

const KEY = 'ww.authReturn'

/** The link's parameters: the query, and a hash that isn't a "#/…" route. */
function params(href: string): URLSearchParams {
  const u = new URL(href)
  const out = new URLSearchParams(u.search)
  const hash = u.hash.slice(1)
  if (hash && !hash.startsWith('/')) new URLSearchParams(hash).forEach((v, k) => out.set(k, v))
  return out
}

export function parseAuthReturn(href: string): AuthReturn | null {
  const p = params(href)
  const err = p.get('error_description') ?? p.get('error')
  if (err) {
    return {
      kind: 'error',
      message:
        p.get('error_code') === 'otp_expired'
          ? 'That email link has expired or was already used. Ask for a new one.'
          : p.get('error_description') ?? 'The email link did not work. Ask for a new one.',
    }
  }
  const access = p.get('access_token')
  const refresh = p.get('refresh_token')
  if (access && refresh) return { kind: 'tokens', accessToken: access, refreshToken: refresh, type: p.get('type') ?? '' }
  const tokenHash = p.get('token_hash')
  if (tokenHash) return { kind: 'otp', tokenHash, type: p.get('type') ?? 'email' }
  const code = p.get('code')
  if (code) return { kind: 'code', code }
  return null
}

/** The same address without the link's codes, keeping the screen ("#/…"). */
export function cleanUrl(href: string): string {
  const u = new URL(href)
  const route = u.hash.startsWith('#/') ? u.hash : '#/'
  return `${u.origin}${u.pathname}${route}`
}

/** Keep the link for the sign-in code to finish (survives the first render). */
export function stashAuthReturn(r: AuthReturn): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(r))
  } catch {
    // private mode: the link is simply not used
  }
}

/** Take the kept link (once). */
export function takeAuthReturn(): AuthReturn | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    sessionStorage.removeItem(KEY)
    return JSON.parse(raw) as AuthReturn
  } catch {
    return null
  }
}
