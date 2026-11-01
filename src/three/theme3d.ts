import { useEffect, useState } from 'react'
import type { KpiStatus } from '../lib/kpi'

// Status colours come from the app's tokens (tokens.css), so a red health bar
// means the same thing as a red chip. The site itself uses a fixed toy palette
// (kit/colors.ts); the light theme is day and the dark theme is night.

export interface Palette {
  dark: boolean
  bad: string
  warn: string
  good: string
  none: string
  info: string
  brand: string
  text: string
  muted: string
  bg: string
  /** Day / night environment */
  sky: string
  sea: string
  hemiSky: string
  hemiGround: string
  hemi: number
  sun: string
  sunI: number
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888888'

function isDark() {
  const forced = document.documentElement.getAttribute('data-theme')
  if (forced) return forced === 'dark'
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
}

export function readPalette(): Palette {
  const dark = isDark()
  return {
    dark,
    bad: css('--bad'),
    warn: css('--warn'),
    good: css('--good'),
    none: css('--none'),
    info: css('--info'),
    brand: css('--brand'),
    text: css('--text'),
    muted: css('--muted'),
    bg: css('--bg'),
    sky: dark ? '#0c1628' : '#a9dcf3',
    sea: dark ? '#0f3552' : '#38a6dc',
    hemiSky: dark ? '#6f86b8' : '#ffffff',
    hemiGround: dark ? '#1a1410' : '#c9a777',
    hemi: dark ? 0.55 : 1.15,
    sun: dark ? '#9fb4ff' : '#fff1d6',
    sunI: dark ? 0.55 : 1.75,
  }
}

/** Palette that follows Settings → Appearance and the phone's theme. */
export function usePalette(): Palette {
  const [p, setP] = useState(readPalette)
  useEffect(() => {
    const update = () => requestAnimationFrame(() => setP(readPalette()))
    window.addEventListener('ww:theme', update)
    const mq = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null
    mq?.addEventListener('change', update)
    return () => {
      window.removeEventListener('ww:theme', update)
      mq?.removeEventListener('change', update)
    }
  }, [])
  return p
}

export const statusColor = (p: Palette, s: KpiStatus) => (s === 'good' ? p.good : s === 'warn' ? p.warn : s === 'bad' ? p.bad : p.none)

/** True when the person asked for less motion. */
export const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
