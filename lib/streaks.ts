/**
 * lib/streaks.ts — Pure streak computation (Brain2 §8b / §9.5)
 *
 * Computes the current and longest run of consecutive completed periods over a
 * set of date-keyed completions. Deliberately store-agnostic so it can power
 * habit streaks, review streaks, focus-session streaks, etc. — callers just hand
 * in the dates on which "the thing" happened.
 *
 * Granularity is selectable (`day` | `week` | `month`). Each completion date is
 * mapped to an integer period index; the longest streak is the longest run of
 * consecutive indices, and the current streak is the run ending at the current
 * period (or the immediately preceding one, so a streak is only considered
 * broken once a whole period has been missed).
 */
import { getWeekStartDate } from "@/lib/date-utils"

export type StreakUnit = "day" | "week" | "month"

export interface StreakResult {
  /** Length of the run ending at (or one period before) the reference period. */
  current: number
  /** Longest consecutive run anywhere in the data. */
  longest: number
  /** ISO date key (YYYY-MM-DD) of the most recent completion, or null. */
  lastDate: string | null
  /** Number of distinct periods with at least one completion. */
  totalActivePeriods: number
}

export interface StreakOptions {
  unit?: StreakUnit
  /** Reference "now" used to anchor the current streak. Defaults to new Date(). */
  today?: Date
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function toDate(value: string | Date): Date | null {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value
  // Treat bare YYYY-MM-DD as a LOCAL calendar date to avoid UTC drift.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

/** Map a date to a monotonically increasing integer index for the given unit. */
export function periodIndex(date: Date, unit: StreakUnit): number {
  switch (unit) {
    case "day": {
      const local = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      return Math.floor(local.getTime() / MS_PER_DAY)
    }
    case "week": {
      const start = getWeekStartDate(date)
      return Math.floor(start.getTime() / MS_PER_DAY / 7)
    }
    case "month":
      return date.getFullYear() * 12 + date.getMonth()
  }
}

function isoKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

/**
 * Compute current + longest streak over a collection of completion dates.
 *
 * @param dates  any iterable of Date objects or date strings (YYYY-MM-DD or ISO).
 */
export function computeStreak(
  dates: Iterable<string | Date>,
  options: StreakOptions = {},
): StreakResult {
  const unit: StreakUnit = options.unit ?? "day"
  const today = options.today ?? new Date()

  const indices = new Set<number>()
  let lastTime = -Infinity
  let lastDate: string | null = null

  for (const value of dates) {
    const d = toDate(value)
    if (!d) continue
    indices.add(periodIndex(d, unit))
    if (d.getTime() > lastTime) {
      lastTime = d.getTime()
      lastDate = isoKey(d)
    }
  }

  const sorted = [...indices].sort((a, b) => a - b)
  if (sorted.length === 0) {
    return { current: 0, longest: 0, lastDate: null, totalActivePeriods: 0 }
  }

  // Longest run of consecutive indices.
  let longest = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      run += 1
    } else {
      run = 1
    }
    if (run > longest) longest = run
  }

  // Current streak: walk back from "today" (or yesterday/last period) while
  // consecutive periods are present.
  const todayIdx = periodIndex(today, unit)
  const present = indices
  let current = 0
  // A streak is alive if the current or the immediately preceding period is
  // marked done (grace period of one so an unfinished today doesn't reset it).
  let cursor: number
  if (present.has(todayIdx)) cursor = todayIdx
  else if (present.has(todayIdx - 1)) cursor = todayIdx - 1
  else cursor = NaN

  if (!Number.isNaN(cursor)) {
    while (present.has(cursor)) {
      current += 1
      cursor -= 1
    }
  }

  return { current, longest, lastDate, totalActivePeriods: sorted.length }
}
