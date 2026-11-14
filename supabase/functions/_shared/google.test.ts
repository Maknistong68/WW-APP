import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { consentUrl, ensureFolder, exchangeCode, uploadJpeg } from './google'

// google.ts runs on Deno; here Deno.env and Google are stand-ins.
const env: Record<string, string> = { GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'secret' }
type Call = { url: string; init?: RequestInit }
let calls: Call[] = []
let answers: Array<(c: Call) => Response> = []

beforeEach(() => {
  calls = []
  answers = []
  vi.stubGlobal('Deno', { env: { get: (k: string) => env[k] } })
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const call = { url: String(url), init }
    calls.push(call)
    const next = answers.shift()
    if (!next) throw new Error(`unexpected call ${url}`)
    return next(call)
  })
})
afterEach(() => vi.unstubAllGlobals())

const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status })

describe('consentUrl', () => {
  it('asks only for the files the app makes, with lasting access', () => {
    const u = new URL(consentUrl('https://x.supabase.co/functions/v1/drive-connect', 'st8'))
    expect(u.origin).toBe('https://accounts.google.com')
    expect(u.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/drive.file openid email')
    expect(u.searchParams.get('access_type')).toBe('offline')
    expect(u.searchParams.get('prompt')).toBe('consent')
    expect(u.searchParams.get('state')).toBe('st8')
    expect(u.searchParams.get('client_id')).toBe('cid')
  })
})

describe('exchangeCode', () => {
  it('keeps the refresh token and reads the email from the id token', async () => {
    const payload = btoa(JSON.stringify({ email: 'team@example.com' })).replace(/=+$/, '')
    answers.push(json({ refresh_token: 'rt', access_token: 'at', id_token: `h.${payload}.s` }))
    await expect(exchangeCode('code1', 'https://r')).resolves.toEqual({ refreshToken: 'rt', accessToken: 'at', email: 'team@example.com' })
    const body = new URLSearchParams(String(calls[0].init?.body))
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('client_secret')).toBe('secret')
  })
  it('says so when Google gives no lasting access', async () => {
    answers.push(json({ access_token: 'at' }))
    await expect(exchangeCode('code1', 'https://r')).rejects.toThrow(/no lasting access/)
  })
  it('passes on Google’s own reason', async () => {
    answers.push(json({ error: 'invalid_grant', error_description: 'Bad Request' }, 400))
    await expect(exchangeCode('code1', 'https://r')).rejects.toThrow('Bad Request')
  })
})

describe('ensureFolder', () => {
  it('uses the folder that is there', async () => {
    answers.push(json({ files: [{ id: 'f1' }] }))
    const cache = new Map<string, string>()
    expect(await ensureFolder('at', "Al Noor's – WO 882", 'root', cache)).toBe('f1')
    const q = new URL(calls[0].url).searchParams.get('q')
    expect(q).toContain("name = 'Al Noor\\'s – WO 882'")
    expect(q).toContain("'root' in parents and trashed = false")
    // cached: no second call
    expect(await ensureFolder('at', "Al Noor's – WO 882", 'root', cache)).toBe('f1')
    expect(calls).toHaveLength(1)
  })
  it('makes it when it isn’t', async () => {
    answers.push(json({ files: [] }), json({ id: 'new1' }))
    expect(await ensureFolder('at', 'Camp 3', 'p1', new Map())).toBe('new1')
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({ name: 'Camp 3', mimeType: 'application/vnd.google-apps.folder', parents: ['p1'] })
  })
})

describe('uploadJpeg', () => {
  it('sends the name, the folder and the photo in one request', async () => {
    answers.push(json({ id: 'file9' }))
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    expect(await uploadJpeg('at', 'F5 2026-11-12 14.32 3f9a.jpg', 'p1', bytes)).toBe('file9')
    const init = calls[0].init!
    expect(calls[0].url).toContain('uploadType=multipart')
    const type = new Headers(init.headers).get('Content-Type')!
    const boundary = type.split('boundary=')[1]
    const body = init.body as Uint8Array
    const text = new TextDecoder('latin1').decode(body)
    expect(text.startsWith(`--${boundary}\r\nContent-Type: application/json`)).toBe(true)
    expect(text).toContain('{"name":"F5 2026-11-12 14.32 3f9a.jpg","parents":["p1"]}')
    expect(text).toContain('Content-Type: image/jpeg\r\n\r\n\xff\xd8\xff\xd9\r\n')
    expect(text.endsWith(`--${boundary}--`)).toBe(true)
  })
  it('passes on Drive’s reason when it refuses', async () => {
    answers.push(json({ error: { message: 'Insufficient permissions' } }, 403))
    await expect(uploadJpeg('at', 'x.jpg', 'p1', new Uint8Array([1]))).rejects.toThrow('Insufficient permissions')
  })
})
