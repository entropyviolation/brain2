/**
 * lib/api-cache.ts — In-memory TTL cache for external API reads
 *
 * City/place/weather/route lookups share this so repeat searches don't hit the
 * network. In-flight requests with the same key are coalesced. Keeps itinerary
 * typing/paste feedback under the ~400ms Doherty threshold on cache hits.
 */

export const TTL = {
  CITY: 60 * 60 * 1000,
  PLACE: 10 * 60 * 1000,
  ROUTE: 30 * 60 * 1000,
  WEATHER: 30 * 60 * 1000,
} as const

type Entry<T> = { value: T; expiresAt: number }

const store = new Map<string, Entry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()

export function cacheGet<T>(key: string): T | undefined {
  const hit = store.get(key)
  if (!hit) return undefined
  if (hit.expiresAt <= Date.now()) {
    store.delete(key)
    return undefined
  }
  return hit.value as T
}

export function cacheHas(key: string): boolean {
  return cacheGet(key) !== undefined
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): T {
  store.set(key, { value, expiresAt: Date.now() + Math.max(0, ttlMs) })
  return value
}

export function cacheClear(prefix?: string): void {
  if (!prefix) {
    store.clear()
    inflight.clear()
    return
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
  for (const key of inflight.keys()) {
    if (key.startsWith(prefix)) inflight.delete(key)
  }
}

/** Return a cached value, or run `fn` once per key and remember the result. */
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key)
  if (hit !== undefined) return hit
  const pending = inflight.get(key) as Promise<T> | undefined
  if (pending) return pending
  const run = fn()
    .then((value) => {
      const miss = value == null || (Array.isArray(value) && value.length === 0)
      cacheSet(key, value, miss ? 30_000 : ttlMs)
      return value
    })
    .finally(() => {
      inflight.delete(key)
    })
  inflight.set(key, run)
  return run
}

/** Run async work over `items` with a concurrency cap (order-preserving). */
export async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return []
  const out: R[] = new Array(items.length)
  let next = 0
  const workerCount = Math.max(1, Math.min(concurrency, items.length))
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const i = next++
        if (i >= items.length) return
        out[i] = await fn(items[i]!, i)
      }
    }),
  )
  return out
}
