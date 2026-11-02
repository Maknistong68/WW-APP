import { describe, expect, it } from 'vitest'
import { cleanUrl, linkFailureText, parseAuthReturn } from './authReturn'

const APP = 'https://ww-app-omega.vercel.app/'

describe('Coming back from an email link', () => {
  it('a sign-in code (same browser)', () => {
    expect(parseAuthReturn(`${APP}?code=abc123`)).toEqual({ kind: 'code', code: 'abc123' })
    expect(parseAuthReturn(`${APP}?code=abc123#/settings`)).toEqual({ kind: 'code', code: 'abc123' })
  })
  it('an invite or reset that carries the session itself', () => {
    expect(
      parseAuthReturn(`${APP}#access_token=AT&expires_at=1&expires_in=3600&refresh_token=RT&token_type=bearer&type=invite`),
    ).toEqual({ kind: 'tokens', accessToken: 'AT', refreshToken: 'RT', type: 'invite' })
    expect(parseAuthReturn(`${APP}#access_token=AT&refresh_token=RT&type=recovery`)).toMatchObject({ kind: 'tokens', type: 'recovery' })
  })
  it('a token to check (works in any browser)', () => {
    expect(parseAuthReturn(`${APP}?token_hash=TH&type=recovery`)).toEqual({ kind: 'otp', tokenHash: 'TH', type: 'recovery' })
    expect(parseAuthReturn(`${APP}?token_hash=TH&type=invite#/`)).toEqual({ kind: 'otp', tokenHash: 'TH', type: 'invite' })
  })
  it('an expired or used link explains itself', () => {
    expect(
      parseAuthReturn(`${APP}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`),
    ).toEqual({ kind: 'error', message: 'That email link has expired or was already used. Ask for a new one.' })
    expect(parseAuthReturn(`${APP}?error=server_error&error_description=Something+broke`)).toEqual({ kind: 'error', message: 'Something broke' })
  })
  it('an ordinary app address is not a link', () => {
    expect(parseAuthReturn(`${APP}#/tickets`)).toBeNull()
    expect(parseAuthReturn(APP)).toBeNull()
    expect(parseAuthReturn(`${APP}?f=all#/tickets`)).toBeNull()
  })
})

describe('Tidying the address bar after a link', () => {
  it('drops the codes and keeps the screen', () => {
    expect(cleanUrl(`${APP}?code=abc#/settings`)).toBe(`${APP}#/settings`)
    expect(cleanUrl(`${APP}#access_token=AT&type=invite`)).toBe(`${APP}#/`)
    expect(cleanUrl(`${APP}?token_hash=TH&type=invite`)).toBe(`${APP}#/`)
  })
})

describe('A link opened in another browser (iPhone: Safari vs the home-screen app)', () => {
  it('says what to do instead of an impossible "same browser"', () => {
    expect(linkFailureText('invalid request: both auth code and code verifier should be non-empty')).toBe(
      'If you just confirmed your email, open WW Co-pilot and sign in. Resetting a password? Ask for a new link here.',
    )
  })
  it('other link problems keep their own words', () => {
    expect(linkFailureText('Token has expired or is invalid')).toBe('Token has expired or is invalid')
  })
})
