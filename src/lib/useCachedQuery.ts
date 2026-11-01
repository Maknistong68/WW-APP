import { useLiveQuery } from 'dexie-react-hooks'

const cache = new Map<string, unknown>()

/**
 * useLiveQuery that starts from the last result for the same key, so a
 * screen opened again shows its data on the first frame (the screen
 * transition captures that frame, and Back restores scroll into it).
 */
export function useCachedLiveQuery<T>(key: string, querier: () => Promise<T> | T, deps: unknown[] = []): T | undefined {
  return useLiveQuery(
    async () => {
      const v = await querier()
      cache.set(key, v)
      return v
    },
    [key, ...deps],
    cache.get(key) as T | undefined,
  )
}
