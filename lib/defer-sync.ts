/**
 * lib/defer-sync.ts — Let the grid paint before derived syncs run
 *
 * Habit, pen-action and tagged-count syncs subscribe to the tracking store and
 * run inside the same `set()` that a grid stroke makes, so the stroke only
 * shows once they all finish. `deferSyncs` wraps a stroke: syncs asked for via
 * `runSync` while it runs are queued and flushed after the next paint. Outside
 * a stroke `runSync` runs at once, so every other writer behaves as before.
 */

let deferring = 0
let queue: (() => void)[] = []
let scheduled = false

function flush(): void {
  scheduled = false
  const jobs = queue
  queue = []
  for (const job of jobs) {
    try {
      job()
    } catch (error) {
      console.error("Deferred sync failed", error)
    }
  }
}

function schedule(): void {
  if (scheduled) return
  scheduled = true
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => setTimeout(flush, 0))
  else setTimeout(flush, 0)
}

export function runSync(job: () => void): void {
  if (deferring === 0) {
    job()
    return
  }
  queue.push(job)
}

export function deferSyncs<T>(fn: () => T): T {
  deferring++
  try {
    return fn()
  } finally {
    deferring--
    if (queue.length > 0) schedule()
  }
}
