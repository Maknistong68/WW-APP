import { useEffect, useSyncExternalStore } from 'react'
import { getClient, getSession } from './sync'
import type { TeamMember } from './actor'

// The team's names (no emails), kept on the phone so "by Ali" shows offline.
// Refreshed when the app opens and after every sync.

const KEY = 'ww.team'
const listeners = new Set<() => void>()

function read(): TeamMember[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    return Array.isArray(v) ? (v as TeamMember[]) : []
  } catch {
    return []
  }
}

let team: TeamMember[] = typeof localStorage === 'undefined' ? [] : read()

export async function refreshTeam(): Promise<void> {
  if (!navigator.onLine) return
  const c = await getClient()
  if (!c || !(await getSession())) return
  const { data, error } = await c.rpc('team_members')
  if (error || !Array.isArray(data)) return
  team = data as TeamMember[]
  try {
    localStorage.setItem(KEY, JSON.stringify(team))
  } catch {
    // private mode: keep it in memory
  }
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** The team's names for "by …" lines. */
export function useTeam(): TeamMember[] {
  const list = useSyncExternalStore(subscribe, () => team)
  useEffect(() => {
    void refreshTeam()
    const onSynced = () => void refreshTeam()
    window.addEventListener('ww-synced', onSynced)
    return () => window.removeEventListener('ww-synced', onSynced)
  }, [])
  return list
}
