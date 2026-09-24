/**
 * components/Analytics/analytics-range.ts — Shared Analytics window + honesty
 *
 * One window for every Analytics tab so Sleep, Habits, Tracking, and
 * Plan-vs-Reality can be compared without re-picking. Presets are rolling last
 * 7 / 14 / 30 / 90 days. A custom window is inclusive local from–to dates
 * (or a named week/month, which still labels as those dates). Interpretive
 * views must show n and refuse to treat a sparse week as a finding.
 */
import { formatLocalDateKey, parseLocalDate, getWeekString, getWeekStartDate, getMonthDates } from "@/lib/date-utils"
import { OVERCOMMITMENT_SAMPLE_FLOOR } from "@/lib/overcommitment"
import { recentDateKeys } from "@/lib/tracking-summary"
import type { PlanPeriod } from "@/lib/plan-vs-reality"
import { persistKey, readAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"

export const ANALYTICS_RANGE_DAYS = [7, 14, 30, 90] as const
export type AnalyticsRangeDays = (typeof ANALYTICS_RANGE_DAYS)[number]
export const DEFAULT_ANALYTICS_RANGE: AnalyticsRangeDays = 30
export const ANALYTICS_RANGE_STORAGE_KEY = persistKey("analytics-range")
export const MAX_CUSTOM_RANGE_DAYS = 800

export type AnalyticsRangeMode = "preset" | "custom"
export type NamedAnalyticsPeriod = "week" | "month"

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

/** Inclusive local dates for this week (Mon–Sun) or this calendar month. */
export function namedPeriodWindow(period: NamedAnalyticsPeriod, today = new Date()): { from: string; to: string } {
  if (period === "week") {
    const start = getWeekStartDate(today)
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
    return { from: formatLocalDateKey(start), to: formatLocalDateKey(end) }
  }
  const days = getMonthDates(today)
  return { from: formatLocalDateKey(days[0]), to: formatLocalDateKey(days[days.length - 1]) }
}

export function dateKeyOf(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const parsed = parseLocalDate(value)
  if (!parsed || Number.isNaN(parsed.getTime())) return null
  return formatLocalDateKey(parsed)
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

export function periodKeysFromDateKeys(period: PlanPeriod, dateKeys: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const key of dateKeys) {
    let periodKey = key
    if (period === "week") {
      const d = parseLocalDate(key)
      if (!d) continue
      periodKey = getWeekString(d)
    } else if (period === "month") {
      periodKey = key.slice(0, 7)
    }
    if (seen.has(periodKey)) continue
    seen.add(periodKey)
    out.push(periodKey)
  }
  return out
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
