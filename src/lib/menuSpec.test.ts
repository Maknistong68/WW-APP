import { describe, expect, it } from 'vitest'
import { EDIT_ACTIONS, campActions, inspectionActions, ticketActions, viewerOnly, workOrderActions } from './menuSpec'

const open = { status: 'Open' as const, contractorUuid: 'c', parentUuid: '' }
const closed = { status: 'Closed' as const, contractorUuid: 'c', parentUuid: '' }

describe('Ticket menu', () => {
  it('an open ticket: close, edit, contractor, copy, delete (a tap already opens it)', () => {
    expect(ticketActions(open)).toEqual(['close', 'edit', 'contractor', 'copy', 'delete'])
  })
  it('a main ticket closes its whole group; a combined one links to its main', () => {
    expect(ticketActions(open, { members: 2 })).toContain('closeGroup')
    expect(ticketActions(open, { members: 2 })).not.toContain('close')
    expect(ticketActions({ ...open, parentUuid: 'm' })).toContain('main')
  })
  it('a closed ticket reopens instead of closing', () => {
    expect(ticketActions(closed)).toContain('reopen')
    expect(ticketActions(closed)).not.toContain('close')
  })
  it('no contractor link when the ticket has none', () => {
    expect(ticketActions({ ...open, contractorUuid: '' })).not.toContain('contractor')
  })
  it('viewers keep only the read actions', () => {
    expect(viewerOnly(ticketActions(open))).toEqual(['contractor', 'copy'])
    expect(EDIT_ACTIONS.has('delete')).toBe(true)
  })
})

describe('Other menus', () => {
  it('work order: fill in, manpower, contractor, turn off or on', () => {
    expect(workOrderActions({ active: true })).toEqual(['fill', 'manpower', 'contractor', 'turnOff'])
    expect(workOrderActions({ active: false })).toEqual(['fill', 'manpower', 'contractor', 'turnOn'])
  })
  it('camp: inspect, contractor when linked, edit', () => {
    expect(campActions({ contractorUuid: 'c' })).toEqual(['inspect', 'contractor', 'edit'])
    expect(campActions({ contractorUuid: '' })).toEqual(['inspect', 'edit'])
  })
  it('inspection: repeat visit, delete; viewers get nothing to change', () => {
    expect(inspectionActions()).toEqual(['repeat', 'delete'])
    expect(viewerOnly(inspectionActions())).toEqual([])
  })
})
