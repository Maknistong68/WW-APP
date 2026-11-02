// ---------------------------------------------------------------------------
// Which phone and browser this is, and how to install the app there. Pure:
// the user agent and touch points come in, so it is tested with real ones.
// ---------------------------------------------------------------------------

export type Device = 'phone' | 'tablet' | 'desktop'
export type Os = 'ios' | 'android' | 'other'
export type Browser = 'safari' | 'chrome' | 'edge' | 'samsung' | 'firefox' | 'inapp' | 'other'

export interface Platform {
  device: Device
  os: Os
  browser: Browser
  /** The app whose built-in browser this is (Instagram, Facebook…), when known. */
  inApp?: string
}

const IN_APP: [RegExp, string][] = [
  [/FBAN|FBAV|FB_IAB/, 'Facebook'],
  [/Instagram/, 'Instagram'],
  [/Line\//, 'LINE'],
  [/WhatsApp/i, 'WhatsApp'],
  [/GSA\//, 'Google'],
  [/Snapchat/i, 'Snapchat'],
  [/LinkedInApp/i, 'LinkedIn'],
]

export function detectPlatform({ ua, maxTouchPoints }: { ua: string; maxTouchPoints: number }): Platform {
  // iPadOS asks for desktop sites and says "Macintosh"; only its touch screen gives it away.
  const iPadAsMac = /Macintosh/.test(ua) && maxTouchPoints > 1
  const ios = /iPhone|iPad|iPod/.test(ua) || iPadAsMac
  const android = /Android/.test(ua)
  const os: Os = ios ? 'ios' : android ? 'android' : 'other'
  const device: Device = iPadAsMac || /iPad/.test(ua) ? 'tablet' : /iPhone|iPod/.test(ua) ? 'phone' : android ? (/Mobile/.test(ua) ? 'phone' : 'tablet') : 'desktop'

  const app = IN_APP.find(([re]) => re.test(ua))
  if (app) return { device, os, browser: 'inapp', inApp: app[1] }
  // An Android WebView inside another app ("; wv)"), or an iOS app's view without "Safari/".
  if ((android && /; wv\)/.test(ua)) || (ios && !iPadAsMac && !/Safari\//.test(ua))) return { device, os, browser: 'inapp' }

  const browser: Browser = /EdgiOS|EdgA|Edg\//.test(ua)
    ? 'edge'
    : /SamsungBrowser/.test(ua)
      ? 'samsung'
      : /FxiOS|Firefox\//.test(ua)
        ? 'firefox'
        : /CriOS|Chrome\//.test(ua)
          ? 'chrome'
          : /Safari\//.test(ua)
            ? 'safari'
            : 'other'
  return { device, os, browser }
}

export type InstallPlan =
  | { kind: 'installed' }
  | { kind: 'prompt' }
  | { kind: 'steps'; steps: string[] }
  | { kind: 'openInBrowser'; steps: string[] }
  | { kind: 'none' }

const ADD = '“Add to Home Screen”'

/** How to install here: the browser's own button, short steps, or "open this in your browser first". */
export function installPlan(p: Platform, s: { canPrompt: boolean; installed: boolean }): InstallPlan {
  if (s.installed) return { kind: 'installed' }
  if (p.browser === 'inapp') {
    return {
      kind: 'openInBrowser',
      steps: [
        `This window${p.inApp ? ` inside ${p.inApp}` : ''} can’t install apps.`,
        'Tap ⋮ or ··· at the top, then “Open in browser”',
        p.os === 'ios' ? 'Then install it from Safari' : 'Then install it from Chrome',
      ],
    }
  }
  if (s.canPrompt) return { kind: 'prompt' }
  if (p.device === 'desktop') return { kind: 'none' }
  if (p.os === 'ios') {
    if (p.browser === 'safari') return { kind: 'steps', steps: ['Tap Share ⬆ (at the bottom, or ··· then Share)', `Tap ${ADD}`, 'Tap “Add”'] }
    if (p.browser === 'chrome') return { kind: 'steps', steps: ['Tap Share ⬆ in the address bar', `Tap ${ADD}`, 'Tap “Add”'] }
    if (p.browser === 'edge') return { kind: 'steps', steps: ['Tap ··· at the bottom', `Tap Share, then ${ADD}`, 'Tap “Add”'] }
    if (p.browser === 'firefox') return { kind: 'steps', steps: ['Tap ☰ at the bottom', `Tap Share, then ${ADD}`, 'Tap “Add”'] }
    return { kind: 'openInBrowser', steps: ['This browser can’t install apps.', 'Open this page in Safari', 'Then tap Share ⬆ and “Add to Home Screen”'] }
  }
  if (p.browser === 'samsung') return { kind: 'steps', steps: ['Tap ≡ at the bottom', 'Tap “Add page to”, then “Home screen”', 'Tap “Add”'] }
  if (p.browser === 'edge') return { kind: 'steps', steps: ['Tap ··· at the bottom', 'Tap “Add to phone”', 'Tap “Install”'] }
  if (p.browser === 'firefox') return { kind: 'steps', steps: ['Tap ⋮ at the top right', 'Tap “Install”', 'Tap “Add”'] }
  return { kind: 'steps', steps: ['Tap ⋮ at the top right', 'Tap “Install app” or “Add to home screen”', 'Tap “Install”'] }
}

/** The install screen comes first on phones and tablets in a browser tab, until they install or skip. Never on a computer. */
export const shouldOfferInstall = (p: Platform, s: { installed: boolean; skipped: boolean }): boolean =>
  p.device !== 'desktop' && !s.installed && !s.skipped
