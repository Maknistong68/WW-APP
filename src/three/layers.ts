/** Which parts of the city are shown (chips on top of the 3D view). */
export interface Layers {
  floors: boolean
  tickets: boolean
  money: boolean
  submissions: boolean
  workers: boolean
  closeout: boolean
  camps: boolean
  tide: boolean
}

export const ALL_LAYERS: Layers = {
  floors: true,
  tickets: true,
  money: true,
  submissions: true,
  workers: true,
  closeout: true,
  camps: true,
  tide: true,
}

export const LAYER_LABEL: Record<keyof Layers, string> = {
  floors: 'KPI floors',
  tickets: 'Tickets',
  money: 'Money',
  submissions: 'Submissions',
  workers: 'Workers',
  closeout: 'Close-out',
  camps: 'Camps',
  tide: 'Backlog tide',
}
