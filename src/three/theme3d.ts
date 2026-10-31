import { useEffect, useState } from 'react'
import type { KpiStatus } from '../lib/kpi'

// The 3D world uses the app's own status colours (tokens.css), so a red
// floor means the same thing as a red chip. Read once per theme change.

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
  island: string
  islandSide: string
  plot: string
  core: string
  /** Floor band with no data: a quiet step from the core. */
  noData: string
  water: string
  gold: string
  sky: Record<KpiStatus, string>
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
    island: dark ? '#1d2824' : '#e4ebe6',
    islandSide: dark ? '#141c19' : '#c9d4cd',
    plot: dark ? '#26332e' : '#f7faf8',
    core: dark ? '#26302c' : '#5b6770',
    noData: dark ? '#3c4843' : '#d7dfdb',
    water: dark ? '#1f6f9a' : '#5fb4dc',
    gold: '#e8b53a',
    sky: dark
      ? { good: '#0b1a26', warn: '#1d1a10', bad: '#24101a', none: '#0f1412' }
      : { good: '#dcebf5', warn: '#efe8d6', bad: '#f1dede', none: '#e9eeeb' },
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

/** Pulse speed for a beacon: critical pulses fast. */
export const pulseSpeed = (s: KpiStatus) => (s === 'bad' ? 5 : s === 'warn' ? 2.4 : s === 'good' ? 1 : 0)

/** True when the person asked for less motion. */
export const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
