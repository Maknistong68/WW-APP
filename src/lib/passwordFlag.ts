// After an invite or a reset link, a password must be set before anything
// else. The note is kept for the person the link was for, so someone else
// signing in on the same phone is never asked to change their own password.

export type PasswordWhy = 'invite' | 'recovery'

export const passwordFlag = (uid: string, why: PasswordWhy) => JSON.stringify({ uid, why })

/** 'invite' / 'recovery' when this signed-in person still has to set a password, else ''. */
export function readPasswordFlag(raw: string | null, uid: string | undefined): PasswordWhy | '' {
  if (!raw || !uid) return ''
  try {
    const v = JSON.parse(raw) as { uid?: unknown; why?: unknown }
    return v.uid === uid && (v.why === 'invite' || v.why === 'recovery') ? v.why : ''
  } catch {
    return ''
  }
}
