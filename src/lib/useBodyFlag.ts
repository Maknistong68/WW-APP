import { useLayoutEffect } from 'react'

const counts = new Map<string, number>()

/**
 * Put a class on <body> while mounted. Counted, so two screens that both set
 * it (one leaving, one arriving) don't remove it from each other.
 */
export function useBodyFlag(name: string, on = true) {
  useLayoutEffect(() => {
    if (!on) return
    counts.set(name, (counts.get(name) ?? 0) + 1)
    document.body.classList.add(name)
    return () => {
      const n = (counts.get(name) ?? 1) - 1
      if (n > 0) counts.set(name, n)
      else {
        counts.delete(name)
        document.body.classList.remove(name)
      }
    }
  }, [name, on])
}
