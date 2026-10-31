import { describe, expect, it } from 'vitest'
import { campTone, closeoutTone, kpiTone, ticketTone, todoTone } from './tone'

describe('tone', () => {
  it('tickets by age, closed neutral', () => {
    const t = (openedAt: string, status = 'Open') => ({ openedAt, status, closedAt: '' }) as never
    expect(ticketTone(t('2026-10-25'), '2026-10-31')).toBe('good')
    expect(ticketTone(t('2026-10-10'), '2026-10-31')).toBe('warn')
    expect(ticketTone(t('2026-09-01'), '2026-10-31')).toBe('bad')
    expect(ticketTone(t('2026-09-01', 'Closed'), '2026-10-31')).toBe('none')
  })
  it('kpi, camps, close-outs and Home items', () => {
    expect([kpiTone('good'), kpiTone('none')]).toEqual(['good', 'none'])
    expect([campTone('ok'), campTone('due'), campTone('never')]).toEqual(['good', 'warn', 'bad'])
    expect([closeoutTone('overdue'), closeoutTone('open'), closeoutTone('closed')]).toEqual(['bad', 'info', 'good'])
    expect([todoTone({ todo: 3, alert: { level: 'warn' } }), todoTone({ todo: 2 }), todoTone({ todo: 0 })]).toEqual(['warn', 'info', 'good'])
  })
})
