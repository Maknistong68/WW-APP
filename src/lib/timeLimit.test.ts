import { afterEach, describe, expect, it, vi } from 'vitest'
import { step, timedFetch } from './timeLimit'

afterEach(() => vi.useRealTimers())

describe('step', () => {
  it('passes the answer through', async () => {
    await expect(step('x', Promise.resolve(5), 1000)).resolves.toBe(5)
  })
  it('a step that never ends says where it stopped', async () => {
    vi.useFakeTimers()
    const p = step('sign-in check', new Promise(() => {}), 15_000)
    vi.advanceTimersByTime(15_000)
    await expect(p).rejects.toThrow('Sync stuck at: sign-in check (15 s)')
  })
  it('its own error comes through unchanged', async () => {
    await expect(step('x', Promise.reject(new Error('boom')), 1000)).rejects.toThrow('boom')
  })
})

describe('timedFetch', () => {
  // a server that never answers, but stops when the request is cancelled
  const silent = vi.fn((_: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))))

  it('gives up after 30 s with a plain message', async () => {
    vi.useFakeTimers()
    const f = timedFetch(silent)
    const p = f('https://x.supabase.co/rest/v1/inspections')
    vi.advanceTimersByTime(30_000)
    await expect(p).rejects.toThrow('No answer from the server in 30 s')
  })
  it('photo files get 120 s', async () => {
    vi.useFakeTimers()
    const f = timedFetch(silent)
    let done = false
    const p = f('https://x.supabase.co/storage/v1/object/photos/team/a.jpg').catch((e: Error) => ((done = true), e.message))
    vi.advanceTimersByTime(60_000)
    await Promise.resolve()
    expect(done).toBe(false)
    vi.advanceTimersByTime(60_000)
    await expect(p).resolves.toBe('No answer from the server in 120 s')
  })
  it('a normal answer passes through', async () => {
    const ok = vi.fn(async () => new Response('{}', { status: 200 }))
    const r = await timedFetch(ok)('https://x/rest/v1/a')
    expect(r.status).toBe(200)
  })
  it('the caller’s own cancel is kept as theirs', async () => {
    const ctrl = new AbortController()
    const p = timedFetch(silent)('https://x/rest/v1/a', { signal: ctrl.signal })
    ctrl.abort()
    await expect(p).rejects.toThrow('aborted')
  })
})
