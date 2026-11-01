import { describe, expect, it } from 'vitest'
import { HUES, MENUS, MENU_HUE } from './hues'

describe('menu colours', () => {
  it('never use the status colours', () => {
    for (const h of Object.values(MENU_HUE)) {
      expect(HUES).toContain(h)
      expect(['bad', 'warn', 'good', 'red', 'amber', 'green', 'orange', 'yellow']).not.toContain(h)
    }
  })
  it('are distinct within each menu', () => {
    for (const [menu, items] of Object.entries(MENUS)) {
      const hues = items.map((i) => MENU_HUE[i])
      expect(new Set(hues).size, menu).toBe(hues.length)
    }
  })
})
