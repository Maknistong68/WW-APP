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
  | 'manpower'
  | 'turnOff'
  | 'turnOn'
  | 'inspect'
  | 'repeat'

/** Actions that change data: hidden from viewers. */
export const EDIT_ACTIONS: ReadonlySet<MenuAction> = new Set<MenuAction>([
  'close',
  'closeGroup',
  'reopen',
  'edit',
  'delete',
  'fill',
  'manpower',
  'turnOff',
  'turnOn',
  'inspect',
  'repeat',
])

export const viewerOnly = (ids: MenuAction[]) => ids.filter((a) => !EDIT_ACTIONS.has(a))

export function ticketActions(
  t: { status: string; contractorUuid: string; parentUuid?: string },
  ctx: { members?: number } = {},
): MenuAction[] {
  const open = t.status !== 'Closed'
  const isMember = !!t.parentUuid
  const ids: MenuAction[] = []
  if (open) ids.push(!isMember && (ctx.members ?? 0) > 0 ? 'closeGroup' : 'close')
  else ids.push('reopen')
  ids.push('edit')
  if (t.contractorUuid) ids.push('contractor')
  if (isMember) ids.push('main')
  ids.push('copy', 'delete')
  return ids
}

export function workOrderActions(wo: { active: boolean }): MenuAction[] {
  return ['fill', 'manpower', 'contractor', wo.active ? 'turnOff' : 'turnOn']
}

export function campActions(camp: { contractorUuid: string }): MenuAction[] {
  return ['inspect', ...(camp.contractorUuid ? (['contractor'] as const) : []), 'edit']
}

export function inspectionActions(): MenuAction[] {
  return ['repeat', 'delete']
}
