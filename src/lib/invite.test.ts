import { describe, expect, it } from 'vitest'
import { inviteLink, inviteProblem, inviteStatus } from './invite'

describe('Inviting a person', () => {
  const ok = { name: 'Mona Ali', email: 'mona@example.com', role: 'editor' as const }
  it('needs a name, an email and a role (no username)', () => {
    expect(inviteProblem(ok)).toBeNull()
    expect(inviteProblem({ ...ok, name: ' ' })).toBe('Type their name')
    expect(inviteProblem({ ...ok, email: 'mona' })).toBe('Check the email')
    expect(inviteProblem({ ...ok, role: 'boss' as never })).toBe('Pick a role')
  })
})

describe('Where an invited person stands', () => {
  it('invited and not joined yet, joined, or signed up on their own', () => {
    expect(inviteStatus({ invited_at: '2026-11-02T10:00:00Z', joined_at: null })).toBe('Invited · not joined yet')
    expect(inviteStatus({ invited_at: '2026-11-02T10:00:00Z', joined_at: '2026-11-03T09:00:00Z' })).toBeNull()
    expect(inviteStatus({ invited_at: null, joined_at: null })).toBeNull()
  })
})

describe('A link to send by hand when the email can’t go', () => {
  it('opens the app and sets the password', () => {
    expect(inviteLink('https://ww-app-omega.vercel.app/', 'abc', 'invite')).toBe('https://ww-app-omega.vercel.app/?token_hash=abc&type=invite')
  })
})
