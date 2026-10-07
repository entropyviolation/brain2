/**
 * lib/cycle-phase.ts — Calendar phase from cycle day marks
 *
 * A label on a local calendar day, derived from bleeding and ovulation marks.
 * Spotting is stored and ignored here. This is not medical advice.
 *
 * Day keys are local `YYYY-MM-DD` (`formatLocalDateKey` / `addCalendarDays`).
 */
import type { CycleDayMark } from "@/lib/cycle-marks"
import { addCalendarDays, formatLocalDateKey } from "@/lib/date-utils"

export type CyclePhase = "menstrual" | "follicular" | "ovulatory" | "luteal" | "unknown"

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/

function isDayKey(value: string): boolean {
  const match = DAY_KEY.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

function nextDayKey(key: string): string | null {
  const match = DAY_KEY.exec(key)
  if (!match || !isDayKey(key)) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return formatLocalDateKey(addCalendarDays(date, 1))
}

interface BleedRun {
  start: string
  end: string
}

/** Maximal contiguous days with `bleeding === true`. Spotting does not join them. */
function bleedRuns(marksByDate: Record<string, CycleDayMark>): BleedRun[] {
  const days = Object.keys(marksByDate)
    .filter((key) => isDayKey(key) && marksByDate[key]?.bleeding === true)
    .sort()
  const runs: BleedRun[] = []
  for (const day of days) {
    const previous = runs[runs.length - 1]
    if (previous && nextDayKey(previous.end) === day) previous.end = day
    else runs.push({ start: day, end: day })
  }
  return runs
}

function latestOvulationBefore(date: string, marksByDate: Record<string, CycleDayMark>): string | null {
  let best: string | null = null
  for (const [key, mark] of Object.entries(marksByDate)) {
    if (!isDayKey(key) || mark?.ovulation !== true) continue
    if (key < date && (best == null || key > best)) best = key
  }
  return best
}

/**
 * Phase of one local day.
 *
 * Menstrual wins, including over ovulation on the same day. Ovulatory is the
 * ovulation day when it is not menstrual. Luteal runs from the day after an
 * ovulation mark until the next bleed run starts; with no later bleed it
 * stays luteal. Follicular is the gap after a bleed when no ovulation in or
 * after that bleed is still in effect. Days before the first bleed and before
 * any ovulation are unknown. No marks at all is unknown.
 */
export function phaseForDate(date: string, marksByDate: Record<string, CycleDayMark>): CyclePhase {
  if (!isDayKey(date)) return "unknown"
  const mark = marksByDate[date]
  if (mark?.bleeding === true) return "menstrual"
  if (mark?.ovulation === true) return "ovulatory"

  const lastBleed = [...bleedRuns(marksByDate)].reverse().find((run) => run.end < date) ?? null
  const lastOvulation = latestOvulationBefore(date, marksByDate)

  // An ovulation during or after the latest finished bleed still opens luteal
  // once menstrual no longer wins. An earlier ovulation was cut off by that bleed.
  if (lastOvulation && (!lastBleed || lastOvulation >= lastBleed.start)) return "luteal"
  if (lastBleed) return "follicular"
  return "unknown"
}
