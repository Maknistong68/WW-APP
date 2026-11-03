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

const LONG_ENOUGH = (pw: string) => pw.length >= 8
const LETTER_AND_NUMBER = (pw: string) => /\p{L}/u.test(pw) && /\d/.test(pw)

/** A new password: 8 or more characters, with a letter and a number. */
export function passwordProblem(pw: string): string | null {
  if (!pw) return 'Type a password'
  if (!LONG_ENOUGH(pw)) return 'Use at least 8 characters'
  if (!LETTER_AND_NUMBER(pw)) return 'Use a letter and a number'
  return null
}

/** The password typed a second time, to be sure of it. */
export function retypeProblem(pw: string, again: string): string | null {
  if (!again) return 'Type the password again'
  if (again !== pw) return 'The passwords don’t match'
  return null
}

/** The rules shown under a new password, ticked as they are met. */
export function passwordChecks(pw: string, again: string): { label: string; ok: boolean }[] {
  return [
    { label: 'At least 8 characters', ok: LONG_ENOUGH(pw) },
    { label: 'A letter and a number', ok: LETTER_AND_NUMBER(pw) },
    { label: 'Both passwords match', ok: !!again && again === pw },
  ]
}

export function emailProblem(raw: string): string | null {
  const e = raw.trim()
  if (!e) return 'Type your email'
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return 'Check the email'
  return null
}

/** The first thing to fix on Create account, top to bottom (name, email, password, the same password again). */
export function signUpProblem(f: { name: string; email: string; password: string; again: string }): string | null {
  return nameProblem(f.name) ?? emailProblem(f.email) ?? passwordProblem(f.password) ?? retypeProblem(f.password, f.again)
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
