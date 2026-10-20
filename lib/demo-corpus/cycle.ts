/**
 * lib/demo-corpus/cycle.ts — Invented cycle day marks for the Demo profile
 *
 * A fixed 29-day rhythm read from the calendar day, so the vault seed and
 * "Fill around this day" agree. Deterministic. Nothing here is real data.
 */
import { addDays } from "date-fns"
import { formatLocalDateKey } from "@/lib/date-utils"
import type { CycleDayMark } from "@/lib/cycle-marks"

const NOTES = ["quiet evening in", "after dinner", "slow Sunday", "", "", "rainy night"]

function hash(key: string): number {
  let h = 2166136261
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296
}

export function demoCycleMark(key: string): CycleDayMark | null {
  const [y, m, d] = key.split("-").map(Number)
  const n = Math.floor(Date.UTC(y!, m! - 1, d!) / 86400000)
  const pos = n % 29
  const r = hash(key)
  const r2 = hash(`${key}:b`)
  const mark: CycleDayMark = { date: key }
  if (pos < 5) mark.bleeding = true
  else if (pos === 5 && r < 0.5) mark.spotting = true
  if (pos === 14) mark.ovulation = true
  if (r < 0.14) mark.intimacy = true
  if (mark.intimacy) {
    const note = NOTES[Math.floor(r2 * NOTES.length)]
    if (note) mark.intimacyNote = note
  }
  if (r < 0.1 || (r2 < 0.08 && !mark.bleeding)) mark.o = true
  return mark.bleeding || mark.spotting || mark.ovulation || mark.o || mark.intimacy ? mark : null
}

/** Marks for the `days` ending at `now` (inclusive), keyed by day. */
export function demoCycleMarks(now: Date, days = 120): Record<string, CycleDayMark> {
  const out: Record<string, CycleDayMark> = {}
  for (let i = 0; i < days; i++) {
    const key = formatLocalDateKey(addDays(now, -i))
    const mark = demoCycleMark(key)
    if (mark) out[key] = mark
  }
  return out
}
