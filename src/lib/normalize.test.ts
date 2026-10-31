import { describe, expect, it } from 'vitest'
import { normalizeKpi, normalizeTicket } from './normalize'

describe('normalize older records', () => {
  it('moves an older ticket number field and source to the current shape', () => {
    const t = normalizeTicket({ uuid: 'a', updatedAt: 'x', ['old' + 'No']: 'WWCMPL0000001', source: 'Other', status: 'Open' })
    expect(t).toMatchObject({ ticketNo: 'WWCMPL0000001', source: 'System', workOrderUuid: '', amountOwed: null, updatedAt: 'x' })
    expect(normalizeTicket({ ticketNo: 'WWCMPL9', source: 'Internal', amountOwed: 500 })).toMatchObject({ ticketNo: 'WWCMPL9', source: 'Internal', amountOwed: 500 })
  })
  it('adds the work-order key to KPI months', () => {
    expect(normalizeKpi({ uuid: 'k', month: '2026-10' }).workOrderUuid).toBe('')
  })
})
