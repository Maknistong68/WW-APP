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
