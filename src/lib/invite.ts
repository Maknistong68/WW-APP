import { emailProblem, nameProblem, usernameProblem } from './authForm'
import type { Role } from './auth'

// Inviting a person (Users page → Invite). The invite-user Edge Function
// checks the same rules (supabase/functions/invite-user).

export interface InviteInput {
  name: string
  username: string
  email: string
  role: Role
}

const ROLES: Role[] = ['admin', 'editor', 'viewer']

export function inviteProblem(f: InviteInput): string | null {
  if (nameProblem(f.name)) return 'Type their name'
  return usernameProblem(f.username) ?? emailProblem(f.email) ?? (ROLES.includes(f.role) ? null : 'Pick a role')
}

/** "Invited · not joined yet" until they first sign in; nothing after (or for people who signed up themselves). */
export function inviteStatus(p: { invited_at?: string | null; joined_at?: string | null }): string | null {
  return p.invited_at && !p.joined_at ? 'Invited · not joined yet' : null
}

/** The link the admin sends by hand when no email could go out (opens the app, which checks it). */
export const inviteLink = (appUrl: string, tokenHash: string, type: 'invite' | 'recovery') =>
  `${appUrl}?token_hash=${encodeURIComponent(tokenHash)}&type=${type}`
