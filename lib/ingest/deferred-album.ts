/**
 * lib/ingest/deferred-album.ts — Hold a photo album until the merged apply finishes
 *
 * Telegram sends each photo as its own update. The promises stay pending until
 * the quiet period ends and the single vault write resolves, so a poll offset
 * or a webhook 200 cannot land when the timer is merely scheduled.
 */
import { mergeAlbum, type Albumish } from "./media-album"

export function createDeferredAlbum<T extends Albumish>(
  apply: (merged: T) => Promise<void>,
  delayMs = 1100,
) {
  const groups = new Map<
    string,
    {
      items: T[]
      timer: ReturnType<typeof setTimeout> | null
      waiters: { resolve: () => void; reject: (err: unknown) => void }[]
    }
  >()

  function push(item: T): Promise<void> {
    const gid = item.mediaGroupId
    if (!gid) return apply(item)
    return new Promise((resolve, reject) => {
      const row = groups.get(gid) ?? { items: [], timer: null, waiters: [] }
      row.items.push(item)
      row.waiters.push({ resolve, reject })
      if (row.timer) clearTimeout(row.timer)
      row.timer = setTimeout(() => {
        groups.delete(gid)
        const waiters = row.waiters
        apply(mergeAlbum(row.items)).then(
          () => {
            for (const waiter of waiters) waiter.resolve()
          },
          (err) => {
            for (const waiter of waiters) waiter.reject(err)
          },
        )
      }, delayMs)
      groups.set(gid, row)
    })
  }

  return { push }
}
