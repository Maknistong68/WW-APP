import { useEffect, useState } from 'react'

// Light by default (readable in the sun), dark when the phone is dark, or
// whatever the person picked in Settings → Appearance.

export type ThemeMode = 'auto' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

const KEY = 'ww.theme'
const EVENT = 'ww:theme'
/** Browser bar colour per theme (matches --bg). */
export const THEME_COLOR: Record<Theme, string> = { light: '#F2F4F3', dark: '#0F1412' }

export function readThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

/** The theme actually shown. */
export function resolveTheme(mode: ThemeMode, prefersDark: boolean): Theme {
  return mode === 'auto' ? (prefersDark ? 'dark' : 'light') : mode
}

const prefersDark = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches

/** Put the theme on <html> and the browser bar. */
export function applyTheme(mode: ThemeMode = readThemeMode()) {
  const root = document.documentElement
  if (mode === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', mode)
  const theme = resolveTheme(mode, prefersDark())
  root.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
}

export function setThemeMode(mode: ThemeMode) {
  try {
    if (mode === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, mode)
  } catch {
    // private mode: still applies for this visit
  }
  applyTheme(mode)
  window.dispatchEvent(new Event(EVENT))
}

/** Call once before the first render; follows the phone while in auto. */
export function initTheme() {
  applyTheme()
  if (typeof matchMedia === 'undefined') return
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (readThemeMode() === 'auto') applyTheme('auto')
  })
}

export function useThemeMode(): [ThemeMode, (m: ThemeMode) => void] {
  const [mode, setMode] = useState<ThemeMode>(readThemeMode)
  useEffect(() => {
    const on = () => setMode(readThemeMode())
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [])
  return [mode, setThemeMode]
}
