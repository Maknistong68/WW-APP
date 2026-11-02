// Which actions a record's long-press menu offers, by record state. Pure, so
// the rules are tested; src/components/menus.tsx turns ids into actions.
// No "Open": a tap already opens the record (as in stock Galaxy apps).

export type MenuAction =
  | 'close'
  | 'closeGroup'
  | 'reopen'
  | 'edit'
  | 'contractor'
  | 'main'
  | 'copy'
  | 'delete'
  | 'fill'
  | 'docs'
  | 'manpower'
  | 'turnOff'
  | 'turnOn'
  | 'turnOnWo'
  | 'inspect'
  | 'repeat'
  | 'tickets'
  | 'trends'
  | 'done'
  | 'skip'

/** Actions that change data: hidden from viewers. */
export const EDIT_ACTIONS: ReadonlySet<MenuAction> = new Set<MenuAction>([
  'close',
  'closeGroup',
  'reopen',
  'edit',
  'delete',
  'fill',
  'docs',
  'manpower',
  'turnOff',
  'turnOn',
  'turnOnWo',
  'inspect',
  'repeat',
  'done',
  'skip',
])

export const viewerOnly = (ids: MenuAction[]) => ids.filter((a) => !EDIT_ACTIONS.has(a))

export function ticketActions(
  t: { status: string; contractorUuid: string; parentUuid?: string },
  ctx: { members?: number; admin?: boolean } = {},
): MenuAction[] {
  const open = t.status !== 'Closed'
  const isMember = !!t.parentUuid
  const ids: MenuAction[] = []
  if (open) ids.push(!isMember && (ctx.members ?? 0) > 0 ? 'closeGroup' : 'close')
  else ids.push('reopen')
  ids.push('edit')
  if (t.contractorUuid) ids.push('contractor')
  if (isMember) ids.push('main')
  ids.push('copy')
  // Removing a ticket is the admin's call alone, with a reason (it can be restored).
  if (ctx.admin) ids.push('delete')
  return ids
}

/**
 * A contractor: its trends and tickets, fill in and documents (when it is scored), edit, and
 * the on/off switch. Turned on but every work order off → turn a work order on.
 */
export function contractorActions(c: { active: boolean }, followed: boolean): MenuAction[] {
  return ['trends', 'tickets', ...(followed ? (['fill', 'docs'] as const) : []), 'edit', c.active ? (followed ? 'turnOff' : 'turnOnWo') : 'turnOn']
}

export function workOrderActions(wo: { active: boolean }): MenuAction[] {
  return ['fill', 'docs', 'manpower', 'tickets', 'trends', 'contractor', wo.active ? 'turnOff' : 'turnOn']
}

export function campActions(camp: { contractorUuid: string }): MenuAction[] {
  return ['inspect', ...(camp.contractorUuid ? (['contractor'] as const) : []), 'edit']
}

/** A routine task: tick off, skip this time (repeats only), edit, delete. */
export function routineActions(r: { repeat: string }): MenuAction[] {
  return ['done', ...(r.repeat !== 'once' ? (['skip'] as const) : []), 'edit', 'delete']
}

export function inspectionActions(): MenuAction[] {
  return ['repeat', 'delete']
}
