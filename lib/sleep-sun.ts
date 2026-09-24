/**
 * lib/sleep-sun.ts — Sleep / wake against that day's sun
 *
 * A night is still keyed by the morning (`lib/sleep-log.ts`). Wake is compared
 * to **that morning's** sunrise. Sleep onset is compared to **the evening's**
 * sunset — the calendar day the person was going to bed on, not today's sun
 * stamped onto every night.
 *
 * Positive minutes mean after the sun event (woke after sunrise; fell asleep
 * after sunset). Negative means before. Productivity / joy around the sun is
 * a later cut; this module only times the two sleep ends.
 */

import { previousDateKey, type SleepNightStat } from "@/lib/sleep-log"

export type DaySunClock = {
  sunriseMinutes: number
  sunsetMinutes: number
}

export type SleepSunNight = {
  date: string
  /** Minutes after that evening's sunset. Negative = before sunset. */
  sleepAfterSunset: number
  /** Minutes after that morning's sunrise. Negative = before sunrise. */
  wakeAfterSunrise: number
  sunsetMinutes: number
  sunriseMinutes: number
}

export type SleepSunSummary = {
  nights: SleepSunNight[]
  medianSleepAfterSunset: number
  medianWakeAfterSunrise: number
}

function median(xs: number[]): number {
  if (!xs.length) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/**
 * Sleep onset as minutes past the evening day's midnight (may exceed 1440
 * when the person fell asleep after midnight).
 */
export function eveningAsleepMinutes(sleptMin: number): number {
  return 1440 + sleptMin
}

export function sleepSunForNight(
  night: Pick<SleepNightStat, "date" | "sleptMin" | "wokeMin">,
  sunForDate: (date: string) => DaySunClock | null | undefined,
): SleepSunNight | null {
  const eveningDate = previousDateKey(night.date)
  const evening = sunForDate(eveningDate)
  const morning = sunForDate(night.date)
  if (!evening || !morning) return null
  return {
    date: night.date,
    sunsetMinutes: evening.sunsetMinutes,
    sunriseMinutes: morning.sunriseMinutes,
    sleepAfterSunset: eveningAsleepMinutes(night.sleptMin) - evening.sunsetMinutes,
    wakeAfterSunrise: night.wokeMin - morning.sunriseMinutes,
  }
}

export function sleepSunSummary(
  nights: Array<Pick<SleepNightStat, "date" | "sleptMin" | "wokeMin">>,
  sunForDate: (date: string) => DaySunClock | null | undefined,
): SleepSunSummary {
  const rows: SleepSunNight[] = []
  for (const night of nights) {
    const row = sleepSunForNight(night, sunForDate)
    if (row) rows.push(row)
  }
  return {
    nights: rows,
    medianSleepAfterSunset: median(rows.map((r) => r.sleepAfterSunset)),
    medianWakeAfterSunrise: median(rows.map((r) => r.wakeAfterSunrise)),
  }
}

/** "48m after sunset" / "12m before sunrise" / "at sunrise". */
export function describeVsSun(deltaMinutes: number, event: "sunrise" | "sunset"): string {
  const rounded = Math.round(deltaMinutes)
  if (rounded === 0) return `at ${event}`
  const abs = Math.abs(rounded)
  const hours = Math.floor(abs / 60)
  const mins = abs % 60
  const span = hours === 0 ? `${mins}m` : mins === 0 ? `${hours}h` : `${hours}h ${mins}m`
  return `${span} ${rounded > 0 ? "after" : "before"} ${event}`
}
