import { useSyncExternalStore } from 'react'
import type { Role } from './auth'

// ---------------------------------------------------------------------------
// Get started (Home): a short list of first steps that checks what the person
// has really done (installed, named, synced, opened…) and points to the next
// one. Each step is done by doing it, never by ticking it.
// ---------------------------------------------------------------------------

export type SeenFlag = 'hold' | 'kpi' | 'dashboard'

export interface OnboardingState {
  role: Role
  /** A cloud account (not a phone-only copy). */
  cloud: boolean
  /** A phone or tablet (the install step). */
  mobile: boolean
  installed: boolean
  hasName: boolean
  synced: boolean
  seen: SeenFlag[]
  /** Approved people in the team. */
  teamSize: number
}

export type StepAction = { to: string } | { install: true }

export interface OnboardingStep {
  id: 'install' | 'name' | 'data' | 'hold' | 'kpi' | 'dashboard' | 'invite'
  title: string
  sub: string
  button: string
  action: StepAction
  done: boolean
}

export function onboardingSteps(s: OnboardingState): { steps: OnboardingStep[]; next?: OnboardingStep; doneCount: number; allDone: boolean } {
  const edit = s.role !== 'viewer'
  const steps: OnboardingStep[] = []
  if (s.mobile)
    steps.push({ id: 'install', title: 'Install the app', sub: 'Opens full screen and works without signal', button: 'Install', action: { install: true }, done: s.installed })
  if (s.cloud) {
    steps.push({ id: 'name', title: 'Add your name', sub: 'Shown on every change you make', button: 'Add name', action: { to: '/settings' }, done: s.hasName })
    steps.push({ id: 'data', title: 'Get the team’s data', sub: 'Syncs by itself when you’re online', button: 'Sync now', action: { to: '/settings' }, done: s.synced })
  }
  if (edit) {
    steps.push({ id: 'hold', title: 'Hold a ticket', sub: 'In Tickets, hold any row to close, edit or more', button: 'Open Tickets', action: { to: '/tickets' }, done: s.seen.includes('hold') })
    steps.push({ id: 'kpi', title: 'Fill in a month’s KPIs', sub: 'Tap + at the bottom, then Monthly entry', button: 'Open Monthly entry', action: { to: '/entry' }, done: s.seen.includes('kpi') })
  } else {
    steps.push({ id: 'dashboard', title: 'Open the Dashboard', sub: 'Tickets, camps and KPIs at a glance', button: 'Open Dashboard', action: { to: '/dashboard' }, done: s.seen.includes('dashboard') })
  }
  if (s.role === 'admin' && s.cloud)
    steps.push({ id: 'invite', title: 'Invite your team', sub: 'Users › Invite: name, username, email, role', button: 'Invite', action: { to: '/users' }, done: s.teamSize >= 2 })
  const doneCount = steps.filter((x) => x.done).length
  return { steps, next: steps.find((x) => !x.done), doneCount, allDone: doneCount === steps.length }
}

// --- Flags kept on the phone, per person -----------------------------------

interface Flags {
  hidden: boolean
  seen: SeenFlag[]
}
const listeners = new Set<() => void>()
let who = ''
let flags: Flags = { hidden: false, seen: [] }
const key = () => `ww.onboarding.${who || 'local'}`

function read(): Flags {
  try {
    const v = JSON.parse(localStorage.getItem(key()) ?? 'null') as Partial<Flags> | null
    return { hidden: !!v?.hidden, seen: Array.isArray(v?.seen) ? (v.seen as SeenFlag[]) : [] }
  } catch {
    return { hidden: false, seen: [] }
  }
}
function write(next: Flags) {
  flags = next
  try {
    localStorage.setItem(key(), JSON.stringify(next))
  } catch {
    // private mode: kept until the app closes
  }
  listeners.forEach((l) => l())
}

/** Whose flags these are (App sets it when someone signs in). */
export function setOnboardingUser(id: string) {
  const next = id || 'local'
  if (next === who) return
  // Read once per person, including the phone-only "local" person (it was never read before).
  who = next
  flags = typeof localStorage === 'undefined' ? { hidden: false, seen: [] } : read()
  listeners.forEach((l) => l())
}

/** The current person's flags (outside React). */
export const getOnboardingFlags = (): Flags => flags

/** Note that something was done (a hold menu opened, KPIs saved, the Dashboard opened). */
export function markSeen(flag: SeenFlag) {
  if (flags.seen.includes(flag)) return
  write({ ...flags, seen: [...flags.seen, flag] })
}

export const hideGetStarted = (hidden: boolean) => write({ ...flags, hidden })

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
export const useOnboardingFlags = (): Flags => useSyncExternalStore(subscribe, () => flags)
