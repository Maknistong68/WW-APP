// Invite a person (admins only). The app sends { name, username, email, role }
// with the admin's session. The person gets an email link to set their
// password; when no email can go out (Supabase's built-in sender only reaches
// its own team), a link comes back for the admin to send by hand.
// { resendFor: userId } makes a fresh link for someone invited who never joined.
import { createClient } from 'npm:@supabase/supabase-js@2'

const URL_ = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const PROD = 'https://ww-app-omega.vercel.app'
const ROLES = ['admin', 'editor', 'viewer']

function origin(req: Request): string {
  const o = req.headers.get('origin') ?? ''
  return o === PROD || o === 'http://localhost:5179' || o === 'http://localhost:5180' || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(o) ? o : PROD
}
const cors = (req: Request) => ({
  'Access-Control-Allow-Origin': origin(req),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
})
const tokenLink = (app: string, hash: string, type: string) => `${app}/?token_hash=${encodeURIComponent(hash)}&type=${type}`

Deno.serve(async (req) => {
  const headers = { ...cors(req), 'Content-Type': 'application/json' }
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return reply({ error: 'Use POST' }, 405)

  // Who is asking: an approved admin only.
  const asCaller = createClient(URL_, ANON, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: me } = await asCaller.auth.getUser()
  if (!me.user) return reply({ error: 'Sign in again.' }, 401)
  const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: caller } = await admin.from('profiles').select('status, role').eq('id', me.user.id).maybeSingle()
  if (!caller || caller.status !== 'approved' || caller.role !== 'admin') return reply({ error: 'Only the admin can invite people.' }, 403)

  const app = origin(req)
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  // A fresh link for someone invited who never joined.
  if (typeof body.resendFor === 'string') {
    const { data: who } = await admin.from('profiles').select('email, joined_at').eq('id', body.resendFor).maybeSingle()
    if (!who?.email) return reply({ error: 'That person was not found.' }, 404)
    if (who.joined_at) return reply({ error: 'They already joined. They can use Forgot password.' }, 409)
    const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email: who.email, options: { redirectTo: `${app}/` } })
    if (error || !data.properties?.hashed_token) return reply({ error: error?.message ?? 'Could not make a link.' }, 500)
    return reply({ id: body.resendFor, emailed: false, link: tokenLink(app, data.properties.hashed_token, 'recovery') })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const username = typeof body.username === 'string' ? body.username.trim().replace(/^@+/, '').toLowerCase() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const role = typeof body.role === 'string' ? body.role : ''
  if (!name || name.length > 60) return reply({ error: 'Type their name.' }, 400)
  if (!/^[a-z0-9][a-z0-9._-]{2,23}$/.test(username)) return reply({ error: 'Username: 3 to 24 letters or numbers (. _ - allowed).' }, 400)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return reply({ error: 'Check the email.' }, 400)
  if (!ROLES.includes(role)) return reply({ error: 'Pick a role.' }, 400)

  const { data: taken } = await admin.from('profiles').select('id').eq('username', username).maybeSingle()
  if (taken) return reply({ error: 'That username is taken.' }, 409)
  const { data: exists } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
  if (exists) return reply({ error: 'This email already has an account.' }, 409)

  const meta = { username, full_name: name }
  let userId = ''
  let emailed = true
  let link: string | undefined
  const sent = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${app}/`, data: meta })
  if (sent.data.user) {
    userId = sent.data.user.id
  } else {
    if (/already (been )?registered/i.test(sent.error?.message ?? '')) return reply({ error: 'This email already has an account.' }, 409)
    // No email could go out: make the account and a link to send by hand.
    emailed = false
    const made = await admin.auth.admin.generateLink({ type: 'invite', email, options: { redirectTo: `${app}/`, data: meta } })
    if (made.error || !made.data.user || !made.data.properties?.hashed_token) {
      return reply({ error: made.error?.message ?? sent.error?.message ?? 'Could not invite.' }, 500)
    }
    userId = made.data.user.id
    link = tokenLink(app, made.data.properties.hashed_token, 'invite')
  }

  // Approved straight away, with the role and names the admin chose.
  const now = new Date().toISOString()
  const { error: upd } = await admin
    .from('profiles')
    .update({ status: 'approved', role, username, full_name: name, invited_by: me.user.id, invited_at: now, decided_at: now })
    .eq('id', userId)
  if (upd) {
    await admin.auth.admin.deleteUser(userId)
    return reply({ error: upd.code === '23505' ? 'That username is taken.' : upd.message }, upd.code === '23505' ? 409 : 500)
  }
  return reply({ id: userId, emailed, ...(link ? { link } : {}) })
})
