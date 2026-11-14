import { describe, expect, it } from 'vitest'
import { mergeAudit, mergesAnswers, planAuditSync, sameContent, stampAnswers } from './auditMerge'
import type { Inspection, QuestionResponse } from '../types'

const r = (assessment: QuestionResponse['assessment'], at?: string, observation = ''): QuestionResponse => ({ yesNo: '', assessment, observation, actionPlan: '', ...(at ? { at } : {}) })
const audit = (p: Partial<Inspection>): Inspection =>
  ({ id: 1, uuid: 'a1', templateId: 'welfare_audit', status: 'draft', createdAt: '2026-11-14T08:00:00.000Z', updatedAt: '2026-11-14T08:00:00.000Z', info: { reviewDate: '2026-11-14' }, responses: {}, notes: '', ...p }) as Inspection

describe('mergeAudit', () => {
  it('keeps both devices’ answers to different questions', () => {
    const phone = audit({ updatedAt: '2026-11-14T08:05:00.000Z', responses: { A1: r('Full compliance', '2026-11-14T08:05:00.000Z') } })
    const laptop = audit({ updatedAt: '2026-11-14T08:06:00.000Z', responses: { B2: r('No compliance', '2026-11-14T08:06:00.000Z', 'No records') } })
    const m = mergeAudit(phone, laptop)
    expect(m.responses.A1.assessment).toBe('Full compliance')
    expect(m.responses.B2.observation).toBe('No records')
    expect(mergeAudit(laptop, phone).responses).toEqual(m.responses)
  })
  it('the same question: the later answer wins, whichever copy was saved last', () => {
    const phone = audit({ updatedAt: '2026-11-14T08:09:00.000Z', responses: { A1: r('Partial compliance', '2026-11-14T08:02:00.000Z'), C1: r('N/A', '2026-11-14T08:09:00.000Z') } })
    const laptop = audit({ updatedAt: '2026-11-14T08:06:00.000Z', responses: { A1: r('No compliance', '2026-11-14T08:06:00.000Z') } })
    expect(mergeAudit(phone, laptop).responses.A1.assessment).toBe('No compliance')
  })
  it('a cleared answer stays cleared', () => {
    const phone = audit({ responses: { A1: r('Full compliance', '2026-11-14T08:01:00.000Z') } })
    const laptop = audit({ updatedAt: '2026-11-14T08:03:00.000Z', responses: { A1: r('', '2026-11-14T08:03:00.000Z') } })
    expect(mergeAudit(phone, laptop).responses.A1.assessment).toBe('')
  })
  it('older answers without a time lose to timed ones, and the newer copy wins a tie', () => {
    const a = audit({ updatedAt: '2026-11-14T08:01:00.000Z', responses: { A1: r('Full compliance') } })
    const b = audit({ updatedAt: '2026-11-14T08:02:00.000Z', responses: { A1: r('No compliance') } })
    expect(mergeAudit(a, b).responses.A1.assessment).toBe('No compliance')
    const timed = audit({ updatedAt: '2026-11-14T08:00:30.000Z', responses: { A1: r('N/A', '2026-11-14T08:00:30.000Z') } })
    expect(mergeAudit(timed, b).responses.A1.assessment).toBe('N/A')
  })
  it('the form and notes come from the newer copy', () => {
    const a = audit({ updatedAt: '2026-11-14T08:01:00.000Z', notes: 'old' })
    const b = audit({ updatedAt: '2026-11-14T08:02:00.000Z', notes: 'new' })
    expect(mergeAudit(a, b).notes).toBe('new')
  })
  it('a finished audit (scores only) wins whole: old answers never come back', () => {
    const finished = audit({ updatedAt: '2026-11-14T08:10:00.000Z', status: 'completed', responses: {}, logged: { pct: 90, rating: 'Excellent' } })
    const stale = audit({ updatedAt: '2026-11-14T08:20:00.000Z', responses: { A1: r('No compliance', '2026-11-14T08:20:00.000Z') } })
    expect(mergeAudit(stale, finished)).toBe(finished)
    expect(mergeAudit(finished, stale)).toBe(finished)
  })
  it('only Worker Welfare audits merge; camp inspections keep the newer copy', () => {
    expect(mergesAnswers(audit({}), audit({}))).toBe(true)
    expect(mergesAnswers(audit({ templateId: 'accommodation' }), audit({}))).toBe(false)
  })
})

describe('planAuditSync', () => {
  const phone = audit({ updatedAt: '2026-11-14T08:05:00.000Z', responses: { A1: r('Full compliance', '2026-11-14T08:05:00.000Z') } })
  const laptop = audit({ id: 99, updatedAt: '2026-11-14T08:06:00.000Z', responses: { B2: r('No compliance', '2026-11-14T08:06:00.000Z') } })

  it('both have something new: both get the merge, saved after both', () => {
    const p = planAuditSync(phone, laptop)
    expect(p.push && p.store).toBe(true)
    expect(Object.keys(p.merged.responses).sort()).toEqual(['A1', 'B2'])
    expect(p.merged.updatedAt).toBe('2026-11-14T08:06:00.001Z')
    expect(p.merged.id).toBe(1)
  })
  it('the cloud has everything: just store it', () => {
    const cloud = audit({ updatedAt: '2026-11-14T08:07:00.000Z', responses: { ...phone.responses, ...laptop.responses } })
    const p = planAuditSync(phone, cloud)
    expect(p).toMatchObject({ push: false, store: true })
    expect(p.merged.updatedAt).toBe(cloud.updatedAt)
  })
  it('this device has everything and is newer: just send it', () => {
    const local = audit({ updatedAt: '2026-11-14T08:07:00.000Z', responses: { ...phone.responses, ...laptop.responses } })
    expect(planAuditSync(local, laptop)).toMatchObject({ push: true, store: false, merged: local })
  })
  it('the same on both: nothing to do', () => {
    expect(planAuditSync(phone, { ...phone, id: 5 })).toMatchObject({ push: false, store: false })
  })
})

describe('stampAnswers', () => {
  it('times only the answers that changed', () => {
    const before = { A1: r('Full compliance', 't0'), A2: r('') }
    const after = { ...before, A2: r('No compliance') }
    const out = stampAnswers(before, after, 't1')
    expect(out.A1.at).toBe('t0')
    expect(out.A2.at).toBe('t1')
    expect(stampAnswers(before, before, 't1')).toBe(before)
  })
  it('keeps a time set on purpose', () => {
    const before = { A1: r('') }
    const after = { A1: r('N/A', 'mine') }
    expect(stampAnswers(before, after, 't1').A1.at).toBe('mine')
  })
})

describe('sameContent', () => {
  it('ignores the save time and local id', () => {
    expect(sameContent(audit({ id: 1, updatedAt: 'x' }), audit({ id: 2, updatedAt: 'y' }))).toBe(true)
  })
  it('ignores the order the server keeps fields in', () => {
    const here = audit({ info: { reviewDate: '2026-11-14', workOrder: '882', auditor: 'WW' } as Inspection['info'], responses: { A1: r('Full compliance', 't1', 'ok'), B2: r('No compliance', 't2') } })
    // as the cloud gives it back: every object's keys in another order
    const flip = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).reverse()) as T
    const cloud = flip({ ...here, info: flip(here.info), responses: flip(Object.fromEntries(Object.entries(here.responses).map(([k, v]) => [k, flip(v)]))) })
    expect(JSON.stringify(cloud)).not.toBe(JSON.stringify(here))
    expect(sameContent(here, cloud)).toBe(true)
  })
})

describe('planAuditSync with the cloud’s field order', () => {
  it('the same audit, fields reordered by the server: nothing to send or store (no endless re-sending)', () => {
    const here = audit({ updatedAt: '2026-11-14T08:05:00.000Z', responses: { A1: r('Full compliance', '2026-11-14T08:05:00.000Z') } })
    const cloud = { ...Object.fromEntries(Object.entries(here).reverse()), info: { ...here.info }, responses: { A1: { at: '2026-11-14T08:05:00.000Z', actionPlan: '', observation: '', assessment: 'Full compliance' as const, yesNo: '' as const } } } as unknown as Inspection
    expect(planAuditSync(here, cloud)).toMatchObject({ push: false, store: false })
  })
})
