/**
 * components/Home/Tracking/waking-scroll.ts — Where the day grid should open
 *
 * Midnight is eight hours of sleep. The grid should land on the first waking
 * hour that still has unpainted minutes, so opening Tracking is a place to
 * paint, not a scroll through last night. Pure: the grid and the sleep log
 * already know the times; this only picks an hour.
 */
import { MINUTES_PER_DAY, type TimeEntry } from "@/lib/time-entries"

/** 7:00 AM — used when this day has no wake time of its own. */
export const DEFAULT_WAKE_MIN = 7 * 60

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value))
}

/**
 * First hour (0–23) after waking that still has a blank minute.
 *
 * Fully painted waking hours are skipped so a logged morning does not hide
 * the gap you actually need to fill. If the whole waking window is painted,
 * this still returns the wake hour — never midnight — unless wake itself is
 * midnight.
 */
export function firstUnpaintedWakingHour({
  map,
  wakeMin = DEFAULT_WAKE_MIN,
  bedMin,
}: {
  map: Array<TimeEntry | null>
  wakeMin?: number
  bedMin?: number
}): number {
  const wake = clamp(Math.round(wakeMin), 0, MINUTES_PER_DAY - 1)
  const bed =
    bedMin === undefined ? MINUTES_PER_DAY : clamp(Math.round(bedMin), wake + 1, MINUTES_PER_DAY)
  const startHour = Math.floor(wake / 60)
  const lastHour = Math.min(23, Math.floor((bed - 1) / 60))
  for (let hour = startHour; hour <= lastHour; hour++) {
    const from = Math.max(hour * 60, wake)
    const to = Math.min((hour + 1) * 60, bed)
    for (let m = from; m < to; m++) {
      if (!map[m]) return hour
    }
  }
  return startHour
}
