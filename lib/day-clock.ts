/**
 * lib/day-clock.ts — Local calendar day, shared with the open app
 *
 * The Scheduler's Today / Tomorrow buckets follow this clock, not a navigated
 * period cursor. `noteDayClock` fires listeners only when the local date
 * actually changes (midnight, or a laptop waking on a new day).
 */
import { formatLocalDateKey } from "@/lib/date-utils"

let dayKey = formatLocalDateKey(new Date())
const listeners = new Set<() => void>()

export function currentDayKey(): string {
  return dayKey
}

export function subscribeDayClock(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Record `now` and notify when its local calendar day differs from the last one. */
export function noteDayClock(now: Date = new Date()): void {
  const next = formatLocalDateKey(now)
  if (next === dayKey) return
  dayKey = next
  listeners.forEach((listener) => listener())
}
