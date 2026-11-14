// Copy photos into the team's Google Drive folder.
//   POST { photoUuids: string[] }  (an approved person who can edit; at most 25 at a time)
//   POST { sweep: true }            (the admin: the next 25 photos not copied yet)
// Each photo comes from the app's own storage (bucket "photos", team/{uuid}.jpg) and goes to
//   WW Co-pilot photos / {contractor – WO} / {date} {audit or camp inspection} / {question} {time}.jpg
// Its Drive id is saved on the photo (photos.drive_file_id), so it is never copied twice; a photo
// is claimed first (photos.drive_claimed_at, freed after 10 minutes or on failure), so two calls
// at once never copy the same one.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { accessToken, ensureFolder, googleReady, uploadJpeg } from '../_shared/google.ts'
import { photoFileName, photoFolders, type DriveInspection } from '../_shared/drivePaths.ts'

const URL_ = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const PROD = 'https://ww-app-omega.vercel.app'
const BATCH = 25
const CLAIM_MINUTES = 10

const origin = (req: Request) => {
  const o = req.headers.get('origin') ?? ''
  return /^http:\/\/localhost:\d+$/.test(o) ? o : PROD
}
const cors = (req: Request) => ({
  'Access-Control-Allow-Origin': origin(req),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
})
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })

Deno.serve(async (req) => {
  const headers = { ...cors(req), 'Content-Type': 'application/json' }
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return reply({ error: 'Use POST' }, 405)

  const asCaller = createClient(URL_, ANON, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: me } = await asCaller.auth.getUser()
  if (!me.user) return reply({ error: 'Sign in again.' }, 401)
  const { data: caller } = await admin.from('profiles').select('status, role').eq('id', me.user.id).maybeSingle()
  if (!caller || caller.status !== 'approved' || (caller.role !== 'admin' && caller.role !== 'editor')) return reply({ error: 'Only editors can copy photos.' }, 403)

  const { data: link } = await admin.from('drive_link').select('refresh_token, root_folder_id').eq('id', 1).maybeSingle()
  if (!googleReady() || !link?.refresh_token || !link.root_folder_id) return reply({ connected: false, copied: 0, failed: 0 })

  const body = (await req.json().catch(() => ({}))) as { photoUuids?: unknown; sweep?: boolean }
  let query = admin.from('photos').select('uuid, inspection_uuid, item_id, created_at').is('drive_file_id', null).eq('deleted', false).limit(BATCH)
  if (body.sweep) {
    if (caller.role !== 'admin') return reply({ error: 'Only the admin can copy every photo.' }, 403)
    query = query.order('created_at')
  } else {
    const ids = Array.isArray(body.photoUuids) ? body.photoUuids.filter((x): x is string => typeof x === 'string').slice(0, BATCH) : []
    if (!ids.length) return reply({ connected: true, copied: 0, failed: 0 })
    query = query.in('uuid', ids)
  }
  const { data: rows, error } = await query
  if (error) return reply({ error: error.message }, 500)

  let at: string
  try {
    at = await accessToken(link.refresh_token)
  } catch (e) {
    return reply({ connected: true, problem: e instanceof Error ? e.message : String(e), copied: 0, failed: rows?.length ?? 0 })
  }
  const folders = new Map<string, string>()
  const inspections = new Map<string, DriveInspection | null>()
  let copied = 0
  let failed = 0
  const done: Record<string, string> = {}
  for (const row of rows ?? []) {
    const stale = new Date(Date.now() - CLAIM_MINUTES * 60 * 1000).toISOString()
    const { data: claimed } = await admin
      .from('photos')
      .update({ drive_claimed_at: new Date().toISOString() })
      .eq('uuid', row.uuid)
      .is('drive_file_id', null)
      .or(`drive_claimed_at.is.null,drive_claimed_at.lt."${stale}"`)
      .select('uuid')
    if (!claimed?.length) continue // another call is copying it
    try {
      if (!inspections.has(row.inspection_uuid)) {
        const { data } = await admin.from('inspections').select('data').eq('uuid', row.inspection_uuid).maybeSingle()
        inspections.set(row.inspection_uuid, (data?.data as DriveInspection | undefined) ?? null)
      }
      const ins = inspections.get(row.inspection_uuid) ?? { templateId: '' }
      let parent = link.root_folder_id
      for (const name of photoFolders(ins)) parent = await ensureFolder(at, name, parent, folders)
      const { data: file, error: dlErr } = await admin.storage.from('photos').download(`team/${row.uuid}.jpg`)
      if (dlErr || !file) throw new Error(dlErr?.message ?? 'Photo file not found')
      const id = await uploadJpeg(at, photoFileName({ uuid: row.uuid, itemId: row.item_id, createdAt: row.created_at }), parent, new Uint8Array(await file.arrayBuffer()))
      await admin.from('photos').update({ drive_file_id: id, drive_claimed_at: null }).eq('uuid', row.uuid)
      done[row.uuid] = id
      copied++
    } catch (e) {
      console.error('drive-photo', row.uuid, e)
      await admin.from('photos').update({ drive_claimed_at: null }).eq('uuid', row.uuid)
      failed++
    }
  }
  const { count } = await admin.from('photos').select('uuid', { count: 'exact', head: true }).is('drive_file_id', null).eq('deleted', false)
  return reply({ connected: true, copied, failed, waiting: count ?? 0, done })
})
