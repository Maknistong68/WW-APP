import { describe, expect, it } from 'vitest'
import { addSubcon, removeSubcon, ticketSubcons } from './subcons'

const t = (workOrderUuid: string, subcontractor: string) => ({ workOrderUuid, subcontractor })

describe('A work order’s subcontractors (company names only)', () => {
  it('adds a name once, trimmed; the same name in other capitals is not added again', () => {
    let l = addSubcon(undefined, '  Sawaed  General Contracting ')
    expect(l).toEqual(['Sawaed General Contracting'])
    l = addSubcon(l, 'sawaed general contracting')
    expect(l).toEqual(['Sawaed General Contracting'])
    expect(addSubcon(l, '   ')).toEqual(l)
    expect(addSubcon(l, 'AGS')).toEqual(['Sawaed General Contracting', 'AGS'])
  })
  it('removes one name', () => {
    expect(removeSubcon(['AGS', 'SNC'], 'AGS')).toEqual(['SNC'])
    expect(removeSubcon(undefined, 'AGS')).toEqual([])
  })
  it('suggests names typed on its tickets, most used first, without the ones already listed', () => {
    const tickets = [t('w1', 'SNC'), t('w1', 'AGS'), t('w1', 'snc '), t('w2', 'Zahid'), t('w1', ''), t('w1', 'Maani')]
    expect(ticketSubcons('w1', tickets, [])).toEqual(['SNC', 'AGS', 'Maani'])
    expect(ticketSubcons('w1', tickets, ['ags'])).toEqual(['SNC', 'Maani'])
    expect(ticketSubcons('w3', tickets, [])).toEqual([])
  })
})
