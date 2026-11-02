/** What stops a ticket from being removed: the admin must say why (kept in the activity log). */
export function removalProblem(reason: string): string | null {
  const r = reason.trim()
  if (!r) return 'Say why it is being removed'
  if (r.length < 5) return 'Say why in a few more words'
  return null
}
