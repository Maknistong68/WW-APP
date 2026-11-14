// Google Drive calls for the Edge Functions (Deno). The app asks only for the
// `drive.file` scope: it can see and change the files and folders it made itself,
// nothing else in the person's Drive.

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const FILES = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id'
const FOLDER = 'application/vnd.google-apps.folder'

export const SCOPE = 'https://www.googleapis.com/auth/drive.file openid email'

const clientId = () => Deno.env.get('GOOGLE_CLIENT_ID') ?? ''
const clientSecret = () => Deno.env.get('GOOGLE_CLIENT_SECRET') ?? ''
export const googleReady = () => !!clientId() && !!clientSecret()

export function consentUrl(redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`
}

async function token(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId(), client_secret: clientSecret(), ...body }),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, string>
  if (!res.ok) throw new Error(json.error_description || json.error || `Google said ${res.status}`)
  return json
}

/** The code from Google's sign-in page → a refresh token (kept on the server) and the account's email. */
export async function exchangeCode(code: string, redirectUri: string): Promise<{ refreshToken: string; accessToken: string; email: string }> {
  const t = await token({ code, redirect_uri: redirectUri, grant_type: 'authorization_code' })
  if (!t.refresh_token) throw new Error('Google sent no lasting access. Remove the app in your Google account’s security settings and connect again.')
  let email = ''
  try {
    const part = (t.id_token ?? '').split('.')[1] ?? ''
    email = (JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as { email?: string }).email ?? ''
  } catch {
    // the email is only shown in Settings
  }
  return { refreshToken: t.refresh_token, accessToken: t.access_token, email }
}

export async function accessToken(refreshToken: string): Promise<string> {
  return (await token({ refresh_token: refreshToken, grant_type: 'refresh_token' })).access_token
}

export async function revoke(refreshToken: string) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, { method: 'POST' }).catch(() => {})
}

const q = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

/** The folder `name` inside `parent` ('root' for the top of My Drive), made if it isn't there. */
export async function ensureFolder(at: string, name: string, parent: string, cache: Map<string, string>): Promise<string> {
  const key = `${parent}/${name}`
  const hit = cache.get(key)
  if (hit) return hit
  const search = new URLSearchParams({
    q: `name = '${q(name)}' and mimeType = '${FOLDER}' and '${parent}' in parents and trashed = false`,
    fields: 'files(id)',
    spaces: 'drive',
  })
  const found = await fetch(`${FILES}?${search}`, { headers: { Authorization: `Bearer ${at}` } })
  const list = (await found.json().catch(() => ({}))) as { files?: { id: string }[] }
  let id = list.files?.[0]?.id
  if (!id) {
    const made = await fetch(`${FILES}?fields=id`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${at}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent] }),
    })
    const json = (await made.json().catch(() => ({}))) as { id?: string; error?: { message?: string } }
    if (!made.ok || !json.id) throw new Error(json.error?.message ?? `Could not make the folder ${name}`)
    id = json.id
  }
  cache.set(key, id)
  return id
}

/** Is this folder still there (not deleted or trashed)? */
export async function folderExists(at: string, id: string): Promise<boolean> {
  const res = await fetch(`${FILES}/${id}?fields=id,trashed`, { headers: { Authorization: `Bearer ${at}` } })
  if (!res.ok) return false
  const json = (await res.json().catch(() => ({}))) as { trashed?: boolean }
  return !json.trashed
}

/** Uploads one JPEG into `parent`; returns its Drive file id. */
export async function uploadJpeg(at: string, name: string, parent: string, bytes: Uint8Array): Promise<string> {
  const boundary = `ww${crypto.randomUUID().replace(/-/g, '')}`
  const enc = new TextEncoder()
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [parent] })}\r\n` +
      `--${boundary}\r\nContent-Type: image/jpeg\r\n\r\n`,
  )
  const tail = enc.encode(`\r\n--${boundary}--`)
  const body = new Uint8Array(head.length + bytes.length + tail.length)
  body.set(head, 0)
  body.set(bytes, head.length)
  body.set(tail, head.length + bytes.length)
  const res = await fetch(UPLOAD, {
    method: 'POST',
    headers: { Authorization: `Bearer ${at}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  const json = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } }
  if (!res.ok || !json.id) throw new Error(json.error?.message ?? `Upload failed (${res.status})`)
  return json.id
}

export const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`
