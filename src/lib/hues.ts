// Menu colours. Samsung menus give every item its own colour (like the
// Settings app); so do ours, for menu-only icons: Library shelves, Create
// choices, the side menu, Settings and Export rows. Red, amber and green are
// never used here: they mean status (src/lib/tone.ts), and anything that shows
// a state keeps its status colour.

export type Hue = 'blue' | 'cyan' | 'indigo' | 'violet' | 'plum' | 'pink' | 'slate'

export const HUES: readonly Hue[] = ['blue', 'cyan', 'indigo', 'violet', 'plum', 'pink', 'slate']

/** One fixed colour per menu item, the same on every screen. */
export const MENU_HUE = {
  contractors: 'blue',
  camps: 'cyan',
  closeout: 'plum',
  inspections: 'violet',
  activity: 'indigo',
  users: 'pink',
  settings: 'slate',
  signOut: 'slate',
  ticket: 'pink',
  kpis: 'indigo',
  backup: 'blue',
  restore: 'cyan',
  exportPack: 'indigo',
  exportExcel: 'cyan',
  exportWord: 'blue',
} as const satisfies Record<string, Hue>

export type MenuItem = keyof typeof MENU_HUE

/** The menus, so a test can check each one shows distinct colours. */
export const MENUS: Record<string, MenuItem[]> = {
  library: ['contractors', 'camps', 'closeout', 'inspections', 'activity', 'users', 'settings'],
  create: ['ticket', 'kpis', 'inspections', 'camps'],
  sideMenu: ['contractors', 'camps', 'closeout', 'inspections', 'activity', 'users', 'settings'],
  settingsData: ['activity', 'backup', 'restore'],
  export: ['exportPack', 'exportExcel', 'exportWord'],
}
