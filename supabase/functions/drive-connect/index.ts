// Google Drive link for the team's photos (one Google account, connected once by the admin).
//   POST { action: 'status' }      any approved person: connected?, the account, the folder, photos waiting
//   POST { action: 'start' }       the admin: the Google sign-in page to open
//   POST { action: 'disconnect' }  the admin: forget the link (photos already copied stay in Drive)
//   GET  ?code=…&state=…           Google sends the admin back here after signing in
// The refresh token lives in public.drive_link, which phones can't read (RLS, no policies):
// only this function and drive-photo (service role) use it.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { accessToken, consentUrl, ensureFolder, exchangeCode, folderExists, folderUrl, googleReady, revoke } from '../_shared/google.ts'
import { ROOT_FOLDER } from '../_shared/drivePaths.ts'

const URL_ = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const PROD = 'https://ww-app-omega.vercel.app'
const REDIRECT = `${URL_}/functions/v1/drive-connect`
const STATE_MINUTES = 15

const origin = (req: Request) => {
  const o = req.headers.get('origin') ?? ''
  return /^http:\/\/localhost:\d+$/.test(o) ? o : PROD
}
const cors = (req: Request) => ({
  'Access-Control-Allow-Origin': origin(req),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  Vary: 'Origin',
})
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })

/** Back to the app's Settings with a word on how it went. */
const backToApp = (word: string) => new Response(null, { status: 302, headers: { Location: `${PROD}/#/settings?drive=${encodeURIComponent(word)}` } })

Deno.serve(async (req) => {
  const headers = { ...cors(req), 'Content-Type': 'application/json' }
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })

  // Google's redirect after the admin signed in
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (url.searchParams.get('error')) return backToApp('cancelled')
    if (!code || !state) return backToApp('failed')
    const { data: link } = await admin.from('drive_link').select('*').eq('id', 1).maybeSingle()
    const fresh = link?.pending_at && Date.now() - new Date(link.pending_at).getTime() < STATE_MINUTES * 60 * 1000
    if (!link || link.pending_state !== state || !fresh) return backToApp('expired')
    try {
      const got = await exchangeCode(code, REDIRECT)
      const cache = new Map<string, string>()
      const keep = link.root_folder_id && (await folderExists(got.accessToken, link.root_folder_id))
      const root = keep ? link.root_folder_id : await ensureFolder(got.accessToken, ROOT_FOLDER, 'root', cache)
      await admin
        .from('drive_link')
        .update({
          refresh_token: got.refreshToken,
          root_folder_id: root,
          connected_email: got.email,
          connected_by: link.pending_by,
          connected_at: new Date().toISOString(),
          pending_state: null,
          pending_at: null,
          pending_by: null,
        })
        .eq('id', 1)
      return backToApp('connected')
    } catch (e) {
      console.error('drive-connect', e)
      return backToApp('failed')
    }
  }
  if (req.method !== 'POST') return reply({ error: 'Use POST' }, 405)

  // Who is asking
  const asCaller = createClient(URL_, ANON, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: me } = await asCaller.auth.getUser()
  if (!me.user) return reply({ error: 'Sign in again.' }, 401)
  const { data: caller } = await admin.from('profiles').select('status, role').eq('id', me.user.id).maybeSingle()
  if (!caller || caller.status !== 'approved') return reply({ error: 'Your account is not approved yet.' }, 403)
  const isAdmin = caller.role === 'admin'
  const body = (await req.json().catch(() => ({}))) as { action?: string }
  const { data: link } = await admin.from('drive_link').select('*').eq('id', 1).maybeSingle()

  if (body.action === 'status') {
    const { count } = await admin.from('photos').select('uuid', { count: 'exact', head: true }).is('drive_file_id', null).eq('deleted', false)
    if (!googleReady()) return reply({ ready: false, connected: false, waiting: count ?? 0 })
    if (!link?.refresh_token) return reply({ ready: true, connected: false, waiting: count ?? 0 })
    let problem: string | undefined
    try {
      await accessToken(link.refresh_token)
    } catch (e) {
      problem = e instanceof Error ? e.message : String(e)
    }
    return reply({
      ready: true,
      connected: true,
      email: link.connected_email ?? '',
      folderUrl: link.root_folder_id ? folderUrl(link.root_folder_id) : '',
      waiting: count ?? 0,
      ...(problem ? { problem } : {}),
    })
  }

  if (!isAdmin) return reply({ error: 'Only the admin can change the Google Drive link.' }, 403)

  if (body.action === 'start') {
    if (!googleReady()) return reply({ error: 'Google sign-in is not set up yet: add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the Edge Function secrets.' }, 409)
    const state = crypto.randomUUID()
    await admin.from('drive_link').upsert({ id: 1, pending_state: state, pending_at: new Date().toISOString(), pending_by: me.user.id })
    return reply({ url: consentUrl(REDIRECT, state) })
  }

  if (body.action === 'disconnect') {
    if (link?.refresh_token) await revoke(link.refresh_token)
    await admin.from('drive_link').update({ refresh_token: null, connected_email: null, connected_by: null, connected_at: null }).eq('id', 1)
    return reply({ connected: false })
  }

  return reply({ error: 'Unknown action.' }, 400)
})
