import type { KpiMonth, Manpower } from '../types'
import type { EntryKey } from './entryItems'

// Monthly entry's unsaved rows, kept for this browser tab (sessionStorage):
// leaving the screen (a tab, the phone's Back) and coming back brings them
// back with the Save bar, so nothing typed is lost before Save.

export interface EntryEdit {
  /** month|item|contractor|work order */
  key: string
  month: string
  item: EntryKey
  contractorUuid: string
  workOrderUuid: string
  /** "Al Fahad · WO 882" */
  label: string
  /** The row as it was when editing began (changes are measured against it). */
  opened: KpiMonth | Manpower
  edited: KpiMonth | Manpower
}

const KEY = 'ww.entryDraft'

export const editKey = (month: string, item: EntryKey, contractorUuid: string, workOrderUuid: string) => `${month}|${item}|${contractorUuid}|${workOrderUuid}`

export function readDraft(): Map<string, EntryEdit> {
  try {
    const list = JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as EntryEdit[]
    return new Map(Array.isArray(list) ? list.filter((e) => e && typeof e.key === 'string').map((e) => [e.key, e]) : [])
  } catch {
    return new Map()
  }
}

export function writeDraft(edits: Map<string, EntryEdit>) {
  try {
    if (edits.size) sessionStorage.setItem(KEY, JSON.stringify([...edits.values()]))
    else sessionStorage.removeItem(KEY)
  } catch {
    // private mode: kept while the screen is open
  }
}
