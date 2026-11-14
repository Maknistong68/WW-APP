// ---------------------------------------------------------------------------
// Sync must never wait forever. A server that doesn't answer, a sign-in check
// that never returns or a device database held by another open copy would leave
// "Sync now" spinning and the Live mark missing. Every server request gets a time
// limit (timedFetch), and the steps before any request get named ones (step), so
// the Sync log says where it stopped: "Sync stuck at: sign-in check (15 s)".
// ---------------------------------------------------------------------------

/** How long a server request may take: photo files get longer. */
export const LIMITS = { api: 30_000, files: 120_000 }

/** `p`, or an error naming the step when it takes longer than `ms`. */
export function step<T>(name: string, p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Sync stuck at: ${name} (${Math.round(ms / 1000)} s)`)), ms)
  })
  return Promise.race([p, late]).finally(() => clearTimeout(timer))
}

const urlOf = (input: RequestInfo | URL) => (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)

/** A fetch whose requests give up after LIMITS (30 s; photo files 120 s), with a plain message. */
export function timedFetch(base: typeof fetch = (...a) => fetch(...a), limits = LIMITS): typeof fetch {
  return (input, init) => {
    const ms = /\/storage\/v1\//.test(urlOf(input)) ? limits.files : limits.api
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), ms)
    // the caller's own cancel still works
    const theirs = init?.signal
    if (theirs) {
      if (theirs.aborted) ctrl.abort()
      else theirs.addEventListener('abort', () => ctrl.abort(), { once: true })
    }
    return base(input, { ...init, signal: ctrl.signal })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted && !theirs?.aborted) throw new Error(`No answer from the server in ${Math.round(ms / 1000)} s`)
        throw err
      })
      .finally(() => clearTimeout(timer))
  }
}
