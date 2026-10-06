/**
 * lib/seasons.ts — Calendar quarters named as seasons
 *
 * A season is a calendar quarter (three months). The names are the house
 * labels so the ritual for 26 Sep 2026 reads "Quarter 2026 Q3 (Fall)":
 *   Q1 Jan–Mar Spring · Q2 Apr–Jun Summer · Q3 Jul–Sep Fall · Q4 Oct–Dec Winter
 * Keys stay `YYYY-Qn`, the same keys rituals already store.
 */
import type { SchedulableFields } from "@/lib/date-utils"
import { taskScheduledInMonth } from "@/lib/date-utils"

export type SeasonName = "Spring" | "Summer" | "Fall" | "Winter"
export type QuarterNumber = 1 | 2 | 3 | 4

export const SEASON_BY_QUARTER: Record<QuarterNumber, SeasonName> = {
  1: "Spring",
  2: "Summer",
  3: "Fall",
  4: "Winter",
}

export const SEASON_ORDER: SeasonName[] = ["Spring", "Summer", "Fall", "Winter"]

export interface SeasonStyle {
  ink: string
  wash: string
  accent: string
  motif: string
}

export const SEASON_STYLE: Record<SeasonName, SeasonStyle> = {
  Spring: { ink: "#1d6b3a", wash: "#e7f4ea", accent: "#3c9a58", motif: "blossom" },
  Summer: { ink: "#8a5a08", wash: "#f8f1d4", accent: "#d4a017", motif: "sun" },
  Fall: { ink: "#8a3b12", wash: "#f6e4d2", accent: "#c4622d", motif: "leaf" },
  Winter: { ink: "#1c4e74", wash: "#e3eef6", accent: "#4a7eaa", motif: "frost" },
}

export function quarterOf(date: Date): QuarterNumber {
  return (Math.floor(date.getMonth() / 3) + 1) as QuarterNumber
}

export function seasonOfQuarter(quarter: QuarterNumber): SeasonName {
  return SEASON_BY_QUARTER[quarter]
}

export function seasonOfDate(date: Date): SeasonName {
  return seasonOfQuarter(quarterOf(date))
}

export function seasonSlug(season: SeasonName): string {
  return season.toLowerCase()
}

export function quarterKey(date: Date): string {
  return `${date.getFullYear()}-Q${quarterOf(date)}`
}

export function parseQuarterKey(key: string): { year: number; quarter: QuarterNumber } | null {
  const match = /^(\d{4})-Q([1-4])$/.exec(key.trim())
  if (!match) return null
  return { year: Number(match[1]), quarter: Number(match[2]) as QuarterNumber }
}

/** "Quarter 2026 Q3 (Fall)" */
export function quarterLabel(key: string): string {
  const parsed = parseQuarterKey(key)
  if (!parsed) return key
  return `Quarter ${parsed.year} Q${parsed.quarter} (${seasonOfQuarter(parsed.quarter)})`
}

export function quarterStartDate(date: Date): Date {
  const q = quarterOf(date)
  return new Date(date.getFullYear(), (q - 1) * 3, 1)
}

export function shiftQuarter(date: Date, delta: number): Date {
  const start = quarterStartDate(date)
  return new Date(start.getFullYear(), start.getMonth() + delta * 3, 1)
}

/** First of each of `count` quarters ending at `date`'s quarter (oldest first). */
export function precedingQuarterStarts(date: Date, count = 7): Date[] {
  const start = quarterStartDate(date)
  return Array.from({ length: count }, (_, i) => shiftQuarter(start, -(count - 1 - i)))
}

export function monthKeysInQuarter(key: string): string[] {
  const parsed = parseQuarterKey(key)
  if (!parsed) return []
  const startMonth = (parsed.quarter - 1) * 3
  return [0, 1, 2].map((i) => `${parsed.year}-${String(startMonth + i + 1).padStart(2, "0")}`)
}

export function quarterEndDate(key: string): Date | null {
  const months = monthKeysInQuarter(key)
  const last = months[months.length - 1]
  if (!last) return null
  const [y, m] = last.split("-").map(Number)
  return new Date(y, m, 0)
}

export function dateInQuarter(date: Date, key: string): boolean {
  return quarterKey(date) === key
}

/** Scheduled day, week, or month falls in this quarter. Year-only rows stay on the year. */
export function taskTouchesQuarter(task: SchedulableFields, key: string): boolean {
  return monthKeysInQuarter(key).some((month) => taskScheduledInMonth(task, month))
}

export function quarterMonthCells(date: Date): { value: string; label: string }[] {
  return monthKeysInQuarter(quarterKey(date)).map((value) => {
    const [y, m] = value.split("-").map(Number)
    const start = new Date(y, m - 1, 1)
    return {
      value,
      label: start.toLocaleDateString("en-US", { month: "long" }),
    }
  })
}
