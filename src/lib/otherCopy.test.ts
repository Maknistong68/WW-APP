import { describe, expect, it } from 'vitest'
import { otherCopyText } from './otherCopy'

describe('The app open twice on one phone', () => {
  it('the installed app asks to close the browser tab', () => {
    expect(otherCopyText(true, false)).toBe('WW Co-pilot is also open in a browser tab. Close that tab: two copies can stop saving.')
  })
  it('a browser tab asks to use the installed app instead', () => {
    expect(otherCopyText(false, true)).toBe('WW Co-pilot is also open as the installed app. Use the app and close this tab: two copies can stop saving.')
  })
  it('two tabs or two windows', () => {
    expect(otherCopyText(false, false)).toBe('WW Co-pilot is also open in another tab. Close one: two copies can stop saving.')
    expect(otherCopyText(true, true)).toBe('WW Co-pilot is also open in another window. Close one: two copies can stop saving.')
  })
})
