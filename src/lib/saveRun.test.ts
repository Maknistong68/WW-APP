import { describe, expect, it } from 'vitest'
import { runSave } from './saveRun'

const logs: string[] = []
const log = (event: string, detail: string) => void logs.push(`${event} | ${detail}`)

describe('Running a save', () => {
  it('a save that works', async () => {
    expect(await runSave('Ticket', async () => {}, { log })).toEqual({ ok: true })
  })
  it('a returned sentence is a problem to fix, and it is logged', async () => {
    logs.length = 0
    expect(await runSave('Ticket', async () => 'Pick an issue', { log })).toEqual({ ok: false, problem: 'Pick an issue' })
    expect(logs).toEqual(['Save stopped | Ticket: Pick an issue'])
  })
  it('a thrown error is explained and logged with its technical name', async () => {
    logs.length = 0
    const quota = Object.assign(new Error('full'), { name: 'QuotaExceededError' })
    const r = await runSave('Task', async () => {
      throw quota
    }, { log })
    expect(r.ok ? '' : r.error?.text).toMatch(/storage is full/)
    expect(logs).toEqual(['Save failed | Task: QuotaExceededError: full'])
  })
  it('a slow save is noted, then still finishes', async () => {
    logs.length = 0
    let slow = 0
    const r = await runSave('KPIs', () => new Promise<void>((res) => setTimeout(res, 30)), { log, slowMs: 5, onSlow: () => slow++ })
    expect(r).toEqual({ ok: true })
    expect(slow).toBe(1)
    expect(logs).toEqual(['Save slow | KPIs: still waiting after 5 ms'])
  })
})

describe('A save that does not finish', () => {
  it('slow first, then stuck; the log says what the phone was doing', async () => {
    logs.length = 0
    const seen: string[] = []
    const r = await runSave('Workers', () => new Promise<void>((res) => setTimeout(res, 40)), {
      log,
      slowMs: 5,
      stuckMs: 15,
      onSlow: () => seen.push('slow'),
      onStuck: () => seen.push('stuck'),
      state: () => 'database open, page visible',
    })
    expect(r).toEqual({ ok: true })
    expect(seen).toEqual(['slow', 'stuck'])
    expect(logs).toEqual([
      'Save slow | Workers: still waiting after 5 ms (database open, page visible)',
      'Save stuck | Workers: still waiting after 15 ms (database open, page visible)',
    ])
  })
})
