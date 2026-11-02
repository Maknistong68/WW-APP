import { describe, expect, it } from 'vitest'
import { detectPlatform, installPlan, offerInstallFirst, shouldOfferInstall } from './platform'

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  iphoneEdge: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/126.0.2592.56 Mobile/15E148 Safari/605.1.15',
  iphoneFirefox: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/30.0 Chrome/143.0.0.0 Mobile Safari/537.36',
  androidEdge: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 EdgA/126.0.0.0',
  whatsapp: 'Mozilla/5.0 (Linux; Android 13; SM-A536E Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.3.12.235',
  facebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.40.103]',
  windowsEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0',
  windowsChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
}
const at = (ua: string, maxTouchPoints = 5) => detectPlatform({ ua, maxTouchPoints })

describe('Which phone and browser this is', () => {
  it('iPhone browsers', () => {
    expect(at(UA.iphoneSafari)).toEqual({ device: 'phone', os: 'ios', browser: 'safari' })
    expect(at(UA.iphoneChrome).browser).toBe('chrome')
    expect(at(UA.iphoneEdge).browser).toBe('edge')
    expect(at(UA.iphoneFirefox).browser).toBe('firefox')
  })
  it('an iPad says "Mac" but has a touch screen', () => {
    expect(at(UA.ipad, 5)).toEqual({ device: 'tablet', os: 'ios', browser: 'safari' })
    expect(at(UA.ipad, 0)).toEqual({ device: 'desktop', os: 'other', browser: 'safari' })
  })
  it('Android browsers, phone and tablet', () => {
    expect(at(UA.androidChrome)).toEqual({ device: 'phone', os: 'android', browser: 'chrome' })
    expect(at(UA.androidTablet).device).toBe('tablet')
    expect(at(UA.samsung).browser).toBe('samsung')
    expect(at(UA.androidEdge).browser).toBe('edge')
  })
  it('apps that open links inside themselves', () => {
    expect(at(UA.whatsapp)).toMatchObject({ browser: 'inapp' })
    expect(at(UA.instagram)).toMatchObject({ browser: 'inapp', inApp: 'Instagram' })
    expect(at(UA.facebook)).toMatchObject({ browser: 'inapp', inApp: 'Facebook' })
  })
  it('computers', () => {
    expect(at(UA.windowsEdge, 0)).toEqual({ device: 'desktop', os: 'other', browser: 'edge' })
    expect(at(UA.windowsChrome, 0).browser).toBe('chrome')
  })
})

describe('How to install it here', () => {
  it('already installed: nothing to do', () => {
    expect(installPlan(at(UA.androidChrome), { canPrompt: true, installed: true }).kind).toBe('installed')
  })
  it('Android with the browser’s own install button', () => {
    expect(installPlan(at(UA.androidChrome), { canPrompt: true, installed: false }).kind).toBe('prompt')
  })
  it('step by step where there is no button', () => {
    const steps = (ua: string) => {
      const plan = installPlan(at(ua), { canPrompt: false, installed: false })
      return { ...plan, steps: 'steps' in plan ? plan.steps : [] }
    }
    expect(steps(UA.iphoneSafari)).toMatchObject({ kind: 'steps' })
    expect(steps(UA.iphoneSafari).steps.join(' ')).toMatch(/Share.*Add to Home Screen/)
    expect(steps(UA.iphoneChrome).steps.join(' ')).toMatch(/Add to Home Screen/)
    expect(steps(UA.samsung).steps.join(' ')).toMatch(/Add page to/)
    expect(steps(UA.androidEdge).steps.join(' ')).toMatch(/Add to phone/)
    expect(steps(UA.androidChrome).steps.join(' ')).toMatch(/Install app|Add to home screen/)
  })
  it('an app’s own browser can’t install: open in the real browser', () => {
    expect(installPlan(at(UA.whatsapp), { canPrompt: false, installed: false }).kind).toBe('openInBrowser')
  })
})

describe('When to ask for the install first', () => {
  it('phones and tablets in a browser tab, until they install or skip', () => {
    expect(shouldOfferInstall(at(UA.iphoneSafari), { installed: false, skipped: false })).toBe(true)
    expect(shouldOfferInstall(at(UA.iphoneSafari), { installed: true, skipped: false })).toBe(false)
    expect(shouldOfferInstall(at(UA.iphoneSafari), { installed: false, skipped: true })).toBe(false)
    expect(shouldOfferInstall(at(UA.ipad, 5), { installed: false, skipped: false })).toBe(true)
  })
  it('never on a computer', () => {
    expect(shouldOfferInstall(at(UA.windowsEdge, 0), { installed: false, skipped: false })).toBe(false)
  })
})

describe('Right after installing from the browser tab', () => {
  const phone = at(UA.androidChrome)
  it('the install screen stays, to say "Installed: open it from your home screen"', () => {
    expect(offerInstallFirst(phone, { installed: false, skipped: false, justInstalled: true })).toBe(true)
  })
  it('"Keep using the browser" after that lets the tab go on', () => {
    expect(offerInstallFirst(phone, { installed: false, skipped: true, justInstalled: false })).toBe(false)
  })
  it('otherwise the usual rule', () => {
    expect(offerInstallFirst(phone, { installed: false, skipped: false, justInstalled: false })).toBe(true)
    expect(offerInstallFirst(at(UA.windowsEdge, 0), { installed: false, skipped: false, justInstalled: true })).toBe(false)
  })
})
