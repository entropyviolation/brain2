/**
 * components/Analytics/analytics-range.ts — Shared Analytics window + honesty
 *
 * One window for every Analytics tab so Sleep, Habits, Tracking, and
 * Plan-vs-Reality can be compared without re-picking. Presets are rolling last
 * 7 / 14 / 30 / 90 days. A custom window is inclusive local from–to dates
 * (or a named week/month, which still labels as those dates). Prev/next shifts
 * that window by its own length (or by calendar week/month/season). Interpretive
 * views must show n and refuse to treat a sparse week as a finding.
 */
import {
  addCalendarDays,
  dateKeyOf,
  formatLocalDateKey,
  parseLocalDate,
  getWeekStartDate,
  getMonthDates,
} from "@/lib/date-utils"
import { periodKeysFromDateKeys } from "@/lib/period-keys"
import { quarterEndDate, quarterKey, quarterStartDate, shiftQuarter } from "@/lib/seasons"
import { OVERCOMMITMENT_SAMPLE_FLOOR } from "@/lib/overcommitment"
import { recentDateKeys } from "@/lib/tracking-summary"
import { persistKey, readAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"

export { dateKeyOf, periodKeysFromDateKeys }

export const ANALYTICS_RANGE_DAYS = [7, 14, 30, 90] as const
export type AnalyticsRangeDays = (typeof ANALYTICS_RANGE_DAYS)[number]
export const DEFAULT_ANALYTICS_RANGE: AnalyticsRangeDays = 30
export const ANALYTICS_RANGE_STORAGE_KEY = persistKey("analytics-range")
export const MAX_CUSTOM_RANGE_DAYS = 800

export type AnalyticsRangeMode = "preset" | "custom"
export type NamedAnalyticsPeriod = "week" | "month" | "quarter"
/** How prev/next advances the shared window. `days` = shift by inclusive length. */
export type AnalyticsWindowUnit = "week" | "month" | "quarter" | "days"

/** Inclusive local bounds. Callers read `from` / `to` (YYYY-MM-DD). */
export type AnalyticsRangeBounds = { from: string; to: string }

export type StoredAnalyticsRange =
  | { mode: "preset"; days: AnalyticsRangeDays }
  | { mode: "custom"; from: string; to: string }

/** Floors below which an interpretive tab must not present a finding. */
export const SAMPLE_FLOORS = {
  calibration: 8,
  correlation: 7,
  contextSwitchDays: 7,
  planVsReality: 3,
  regretDays: 7,
  overcommitment: OVERCOMMITMENT_SAMPLE_FLOOR,
  entropyDays: 5,
  transitions: 8,
  spectrum: 14,
} as const

export function isAnalyticsRangeDays(value: unknown): value is AnalyticsRangeDays {
  return typeof value === "number" && (ANALYTICS_RANGE_DAYS as readonly number[]).includes(value)
}

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string") return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return parseLocalDate(value) !== null
}

export function rangeLabel(days: number): string {
  return `last ${days} days`
}

export function customRangeLabel(fromKey: string, toKey: string): string {
  return `${fromKey} – ${toKey}`
}

export function rangeWindowCaption(days: number, today = new Date()): string {
  const keys = recentDateKeys(days, today)
  if (keys.length === 0) return rangeLabel(days)
  return `${rangeLabel(days)} · ${keys[0]} – ${keys[keys.length - 1]}`
}

export function customRangeCaption(fromKey: string, toKey: string): string {
  return customRangeLabel(fromKey, toKey)
}

/**
 * Inclusive local calendar keys from `fromKey` to `toKey`. Swaps inverted
 * bounds. Caps length so a 1900–2026 pick cannot freeze the tab.
 */
export function dateKeysInclusive(fromKey: string, toKey: string): string[] {
  const a = parseLocalDate(fromKey)
  const b = parseLocalDate(toKey)
  if (!a || !b) return []
  const start = a.getTime() <= b.getTime() ? a : b
  const end = a.getTime() <= b.getTime() ? b : a
  const keys: string[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  while (cursor.getTime() <= last.getTime() && keys.length < MAX_CUSTOM_RANGE_DAYS) {
    keys.push(formatLocalDateKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return keys
}

/** Inclusive local dates for this week (Mon–Sun), this calendar month, or this season. */
export function namedPeriodWindow(period: NamedAnalyticsPeriod, today = new Date()): AnalyticsRangeBounds {
  if (period === "week") {
    const start = getWeekStartDate(today)
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
    return { from: formatLocalDateKey(start), to: formatLocalDateKey(end) }
  }
  if (period === "quarter") {
    const start = quarterStartDate(today)
    const end = quarterEndDate(quarterKey(today)) ?? start
    return { from: formatLocalDateKey(start), to: formatLocalDateKey(end) }
  }
  const days = getMonthDates(today)
  return { from: formatLocalDateKey(days[0]), to: formatLocalDateKey(days[days.length - 1]) }
}

export function namedPeriodToWindowUnit(period: NamedAnalyticsPeriod): AnalyticsWindowUnit {
  return period === "quarter" ? "quarter" : period
}

/**
 * Infer step unit from exact inclusive bounds: Mon–Sun week, 1st–last of a
 * calendar month, or a full season/quarter. Anything else is day-count length.
 */
export function analyticsWindowUnit(fromKey: string, toKey: string): AnalyticsWindowUnit {
  const keys = dateKeysInclusive(fromKey, toKey)
  if (keys.length === 0) return "days"
  const from = parseLocalDate(keys[0])
  const to = parseLocalDate(keys[keys.length - 1])
  if (!from || !to) return "days"

  const weekStart = getWeekStartDate(from)
  if (
    keys.length === 7 &&
    formatLocalDateKey(weekStart) === keys[0] &&
    formatLocalDateKey(addCalendarDays(weekStart, 6)) === keys[keys.length - 1]
  ) {
    return "week"
  }

  const monthDays = getMonthDates(from)
  if (
    formatLocalDateKey(monthDays[0]) === keys[0] &&
    formatLocalDateKey(monthDays[monthDays.length - 1]) === keys[keys.length - 1]
  ) {
    return "month"
  }

  const qKey = quarterKey(from)
  const qEnd = quarterEndDate(qKey)
  if (qEnd && formatLocalDateKey(quarterStartDate(from)) === keys[0] && formatLocalDateKey(qEnd) === keys[keys.length - 1]) {
    return "quarter"
  }

  return "days"
}

function shiftByUnit(
  fromKey: string,
  toKey: string,
  unit: AnalyticsWindowUnit,
  direction: -1 | 1,
): AnalyticsRangeBounds | null {
  const keys = dateKeysInclusive(fromKey, toKey)
  if (keys.length === 0) return null
  const from = parseLocalDate(keys[0])
  const to = parseLocalDate(keys[keys.length - 1])
  if (!from || !to) return null

  if (unit === "week") {
    const start = getWeekStartDate(from)
    const shifted = addCalendarDays(start, direction * 7)
    return {
      from: formatLocalDateKey(shifted),
      to: formatLocalDateKey(addCalendarDays(shifted, 6)),
    }
  }

  if (unit === "month") {
    const shifted = new Date(from.getFullYear(), from.getMonth() + direction, 1)
    const days = getMonthDates(shifted)
    return {
      from: formatLocalDateKey(days[0]),
      to: formatLocalDateKey(days[days.length - 1]),
    }
  }

  if (unit === "quarter") {
    const shifted = shiftQuarter(from, direction)
    const qKey = quarterKey(shifted)
    const end = quarterEndDate(qKey) ?? shifted
    return {
      from: formatLocalDateKey(quarterStartDate(shifted)),
      to: formatLocalDateKey(end),
    }
  }

  const len = keys.length
  if (direction === -1) {
    const newTo = addCalendarDays(from, -1)
    return {
      from: formatLocalDateKey(addCalendarDays(newTo, -(len - 1))),
      to: formatLocalDateKey(newTo),
    }
  }
  const newFrom = addCalendarDays(to, 1)
  return {
    from: formatLocalDateKey(newFrom),
    to: formatLocalDateKey(addCalendarDays(newFrom, len - 1)),
  }
}

function clampForwardWindow(
  bounds: AnalyticsRangeBounds,
  unit: AnalyticsWindowUnit,
  length: number,
  todayKey: string,
): AnalyticsRangeBounds | null {
  if (bounds.to <= todayKey) return bounds
  if (bounds.from > todayKey) return null
  if (unit === "days") {
    const end = parseLocalDate(todayKey)
    if (!end) return null
    return {
      from: formatLocalDateKey(addCalendarDays(end, -(length - 1))),
      to: todayKey,
    }
  }
  return { from: bounds.from, to: todayKey }
}

/**
 * Shift an inclusive from–to window one step. Pass `unit` when the store knows
 * the window is a named week/month/season (keeps calendar steps after Next
 * clamps a partial current period); otherwise the unit is inferred from shape.
 * Forward steps never end after `today` (clamp). Returns null when the step
 * would not move the window (already at today for Next).
 */
export function stepAnalyticsWindow(
  fromKey: string,
  toKey: string,
  direction: -1 | 1,
  today: Date = new Date(),
  unit?: AnalyticsWindowUnit | null,
): AnalyticsRangeBounds | null {
  const keys = dateKeysInclusive(fromKey, toKey)
  if (keys.length === 0) return null
  const from = keys[0]
  const to = keys[keys.length - 1]
  const todayKey = formatLocalDateKey(today)
  const resolved = unit ?? analyticsWindowUnit(from, to)

  if (direction === 1 && to >= todayKey && resolved === "days") return null
  // Calendar windows may still end after today (e.g. "this week" mid-week);
  // Next from a window that already ends on/after today is a no-op unless
  // we are still before the natural next period — treat as frontier.
  if (direction === 1 && to >= todayKey) return null

  const shifted = shiftByUnit(from, to, resolved, direction)
  if (!shifted) return null

  const next =
    direction === 1 ? clampForwardWindow(shifted, resolved, keys.length, todayKey) : shifted
  if (!next) return null
  if (next.from === from && next.to === to) return null
  return next
}

/** Previous inclusive window for the same unit/length. Fields: `from`, `to`. */
export function previousAnalyticsWindow(
  fromKey: string,
  toKey: string,
  unit?: AnalyticsWindowUnit | null,
): AnalyticsRangeBounds | null {
  return stepAnalyticsWindow(fromKey, toKey, -1, new Date(), unit)
}

/** Next inclusive window; clamps so `to` never ends after today. */
export function nextAnalyticsWindow(
  fromKey: string,
  toKey: string,
  today: Date = new Date(),
  unit?: AnalyticsWindowUnit | null,
): AnalyticsRangeBounds | null {
  return stepAnalyticsWindow(fromKey, toKey, 1, today, unit)
}

export function inRange(value: Date | string | null | undefined, keys: ReadonlySet<string>): boolean {
  const key = dateKeyOf(value)
  return key !== null && keys.has(key)
}

export function isThinSample(n: number, floor: number): boolean {
  return n < floor
}

export function thinWindowSentence(n: number, floor: number, window: number | string): string {
  const span =
    typeof window === "number"
      ? `the last ${window} days`
      : window.startsWith("last ")
        ? `the ${window}`
        : window
  return `n = ${n} in ${span} — too thin to treat as a finding (need ${floor}).`
}

export function readStoredAnalyticsRange(): StoredAnalyticsRange {
  if (typeof window === "undefined") return { mode: "preset", days: DEFAULT_ANALYTICS_RANGE }
  const raw = readAliasedLocal(ANALYTICS_RANGE_STORAGE_KEY)
  if (!raw) return { mode: "preset", days: DEFAULT_ANALYTICS_RANGE }
  const n = Number(raw)
  if (isAnalyticsRangeDays(n)) return { mode: "preset", days: n }
  try {
    const parsed = JSON.parse(raw) as StoredAnalyticsRange
    if (parsed?.mode === "custom" && isDateKey(parsed.from) && isDateKey(parsed.to)) {
      return { mode: "custom", from: parsed.from, to: parsed.to }
    }
    if (parsed?.mode === "preset" && isAnalyticsRangeDays(parsed.days)) {
      return { mode: "preset", days: parsed.days }
    }
  } catch {
    /* legacy garbage */
  }
  return { mode: "preset", days: DEFAULT_ANALYTICS_RANGE }
}

export function writeStoredAnalyticsRange(days: AnalyticsRangeDays): void {
  if (typeof window === "undefined") return
  writeAliasedLocal(ANALYTICS_RANGE_STORAGE_KEY, String(days))
}

export function writeStoredCustomRange(from: string, to: string): void {
  if (typeof window === "undefined") return
  const keys = dateKeysInclusive(from, to)
  if (keys.length === 0) return
  writeAliasedLocal(
    ANALYTICS_RANGE_STORAGE_KEY,
    JSON.stringify({ mode: "custom", from: keys[0], to: keys[keys.length - 1] } satisfies StoredAnalyticsRange),
  )
}
