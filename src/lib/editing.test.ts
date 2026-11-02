import { describe, expect, it } from 'vitest'
import { beginEdit, editingCount, onEditingIdle } from './editing'

describe('Open forms', () => {
  it('are counted, and closing the last one says so once', () => {
    let idle = 0
    const off = onEditingIdle(() => idle++)
    const a = beginEdit()
    const b = beginEdit()
    expect(editingCount()).toBe(2)
    a()
    a() // closing twice counts once
    expect(idle).toBe(0)
    b()
    expect(editingCount()).toBe(0)
    expect(idle).toBe(1)
    off()
  })
})
