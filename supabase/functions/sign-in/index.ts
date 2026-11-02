// Sign in with a username (or an email). The app sends { login, password };
// this finds the email for a username with the service role, signs in with
// the public key and returns the session. The answer is the same whether the
// username or the password is wrong, so it never tells who has an account.
// After 10 wrong tries in 15 minutes that login is held back for a while.
// Deployed with verify_jwt off: a person signing in has no session yet.
import { createClient } from 'npm:@supabase/supabase-js@2'

const URL_ = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ORIGINS = ['https://ww-app-omega.vercel.app', 'http://localhost:5179', 'http://localhost:5180']
const WRONG = 'Wrong username, email or password.'
const BUSY = 'Sign-in is busy right now. Wait a minute, then try again.'
// An unknown username answers after about as long as a real password check,
// so the timing doesn't tell whether a username exists.
const pause = () => new Promise((r) => setTimeout(r, 250 + Math.random() * 300))

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  return {
    // Only the real app (and local test copies): other sites can't drive sign-ins from a browser.
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

Deno.serve(async (req) => {
  const headers = { ...cors(req), 'Content-Type': 'application/json' }
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return reply({ error: 'Use POST' }, 405)

  const body = (await req.json().catch(() => ({}))) as { login?: unknown; password?: unknown }
  const login = typeof body.login === 'string' ? body.login.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!login || !password) return reply({ error: 'Type your username or email, and your password.' }, 400)
  // Nothing longer than an email address is kept or checked.
  if (login.length > 254 || password.length > 200) return reply({ error: WRONG }, 400)

  const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  const key = login.replace(/^@+/, '')
  const { data: blocked } = await admin.rpc('sign_in_blocked', { p_key: key })
  if (blocked) return reply({ error: 'Too many tries. Wait 15 minutes, or reset your password.' }, 429)

  let email = key
  if (!key.includes('@')) {
    const { data } = await admin.rpc('login_email', { p_username: key })
    if (typeof data !== 'string' || !data) {
      await admin.rpc('note_sign_in', { p_key: key, p_ok: false })
      await pause()
      return reply({ error: WRONG }, 401)
    }
    email = data
  }

  const anon = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await anon.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    // Supabase itself busy or limiting (all username sign-ins come from this one place): not a wrong password.
    const status = (error as { status?: number } | null)?.status ?? 0
    if (status === 429 || status >= 500) return reply({ error: BUSY }, 503)
    await admin.rpc('note_sign_in', { p_key: key, p_ok: false })
    if (error && /email not confirmed/i.test(error.message)) return reply({ error: 'Confirm your email first: open the link we sent you.' }, 401)
    return reply({ error: WRONG }, 401)
  }
  await admin.rpc('note_sign_in', { p_key: key, p_ok: true })
  return reply({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })
})
