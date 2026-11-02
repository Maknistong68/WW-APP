import { getClient } from './sync'

/**
 * Call one of the app's Edge Functions with the signed-in person's session.
 * Throws the function's own message ("That username is taken.") when it says no.
 */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const c = await getClient()
  if (!c) throw new Error('Cloud sync is not set up')
  // Never call with the public key alone: an expired session is refreshed first, a lost one says so.
  const { data: s } = await c.auth.getSession()
  if (!s.session) throw new Error('Sign in again: your sign-in ran out.')
  const { data, error } = await c.functions.invoke(name, { body })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const said = ctx && typeof ctx.json === 'function' ? ((await ctx.json().catch(() => null)) as { error?: string } | null) : null
    throw new Error(said?.error ?? (/fetch|network/i.test(error.message) ? 'No internet. Try again when you’re online.' : error.message))
  }
  return data as T
}
