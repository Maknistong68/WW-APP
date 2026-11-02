// Rules for names and usernames, the same as the database's
// (profiles_username_format, profiles_full_name_len in supabase/schema.sql).

/** "  @Ali.Hassan " → "ali.hassan" */
export const normUsername = (u: string) => u.trim().replace(/^@+/, '').toLowerCase()

export function usernameProblem(raw: string): string | null {
  const u = normUsername(raw)
  if (!u) return 'Choose a username'
  if (u.length < 3 || u.length > 24) return 'Username: 3 to 24 letters'
  if (!/^[a-z0-9._-]+$/.test(u)) return 'Username: letters or numbers only (. _ - allowed)'
  if (!/^[a-z0-9]/.test(u)) return 'Username must start with a letter or number'
  return null
}

export function nameProblem(raw: string): string | null {
  const n = raw.trim()
  if (!n) return 'Type your name'
  if (n.length > 60) return 'Name: at most 60 letters'
  return null
}

/** What was typed in "Username or email": an @ inside means an email. */
export function parseLogin(raw: string): { kind: 'email' | 'username'; value: string } {
  const v = raw.trim()
  if (/^[^@\s]+@[^@\s]+$/.test(v)) return { kind: 'email', value: v.toLowerCase() }
  return { kind: 'username', value: normUsername(v) }
}

export function passwordProblem(pw: string): string | null {
  if (!pw) return 'Type a password'
  if (pw.length < 8) return 'Use at least 8 characters'
  return null
}

export function emailProblem(raw: string): string | null {
  const e = raw.trim()
  if (!e) return 'Type your email'
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return 'Check the email'
  return null
}

/** The first thing to fix on Create account, top to bottom. */
export function signUpProblem(f: { name: string; username: string; email: string; password: string }): string | null {
  return nameProblem(f.name) ?? usernameProblem(f.username) ?? emailProblem(f.email) ?? passwordProblem(f.password)
}

/** Supabase Auth's messages, in plain words. */
export function authProblemText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/failed to fetch|network|load failed/i.test(msg)) return 'No internet. Try again when you’re online.'
  if (/rate limit|too many/i.test(msg)) return 'Too many tries. Wait a few minutes, then try again.'
  if (/already registered|already been registered|already exists/i.test(msg)) return 'This email already has an account. Sign in instead.'
  if (/invalid login credentials/i.test(msg)) return 'Wrong username, email or password.'
  if (/email not confirmed/i.test(msg)) return 'Confirm your email first: open the link we sent you.'
  return msg
}
