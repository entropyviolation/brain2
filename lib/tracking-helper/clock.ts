/**
 * lib/tracking-helper/clock.ts — Place days and clocks, in code
 *
 * Days: "Friday" is the latest Friday that is not after today; "october 31st" is this year's, or
 * last year's when that date is still ahead. Clocks: "4:30" carries no am/pm, so each is placed by
 * **continuity**. A day is told in order, so an unmarked clock is the earliest reading that is not
 * before the clock before it. 4:30, 5, 5:55, 6:19, 7:19 climb through the evening with no hint at
 * all. The first clock of a day has nothing before it, so a sentence word ("this morning"), then
 * waking-hour sense (1–6 is afternoon, 7–11 is morning, 12 is noon) decides.
 */

import type { Token } from "./types"

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

export const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

const atNoon = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12)

const shift = (d: Date, days: number) => {
  const out = atNoon(d)
  out.setDate(out.getDate() + days)
  return out
}

/** The calendar day a day word names, as `YYYY-MM-DD`, or null when it is not one. */
export function resolveDay(raw: string, now: Date): string | null {
  const w = raw.toLowerCase().replace(/\s+/g, " ").trim()
  if (/^(today|tonight|this (morning|afternoon|evening))$/.test(w)) return dateKey(now)
  if (w === "yesterday" || w === "last night") return dateKey(shift(now, -1))

  const weekday = WEEKDAYS.findIndex((d) => w.endsWith(d))
  if (weekday >= 0) {
    const back = (now.getDay() - weekday + 7) % 7
    // "friday" said on a Friday is today; "last friday" is a week back.
    return dateKey(shift(now, -(w.startsWith("last ") ? back || 7 : back)))
  }

  let month = -1
  let day = 0
  let year = now.getFullYear()
  const named = /^([a-z]+)\.?\s+(\d{1,2})/.exec(w)
  const numeric = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(w)
  if (named) {
    month = MONTHS.indexOf(named[1]!.slice(0, 3))
    day = Number(named[2])
  } else if (numeric) {
    month = Number(numeric[1]) - 1
    day = Number(numeric[2])
    if (numeric[3]) year = Number(numeric[3]) < 100 ? 2000 + Number(numeric[3]) : Number(numeric[3])
  }
  if (month < 0 || day < 1 || day > 31) return null
  let date = new Date(year, month, day, 12)
  if (date.getMonth() !== month) return null
  if (!numeric?.[3] && date.getTime() > atNoon(now).getTime()) date = new Date(year - 1, month, day, 12)
  return dateKey(date)
}

/** Hour and minute as minutes past midnight, for every reading the clock could mean. */
function candidates(t: Token): number[] {
  const h = t.hour ?? 0
  const m = t.minute ?? 0
  if (t.ampm === "pm") return [(h % 12) * 60 + 12 * 60 + m]
  if (t.ampm === "am") return [(h % 12) * 60 + m]
  if (h === 0 || h > 12) return [(h % 24) * 60 + m]
  return [(h % 12) * 60 + m, (h % 12) * 60 + 12 * 60 + m]
}

/** The reading for a clock with nothing before it: a sentence word first, then waking-hour sense. */
function firstReading(t: Token, options: number[]): number {
  if (options.length === 1) return options[0]!
  if (t.period) return t.period === "am" ? options[0]! : options[1]!
  const h = t.hour ?? 0
  return h >= 7 && h <= 11 ? options[0]! : options[1]!
}

/**
 * Minutes past midnight for each clock token, in reading order. A day token resets the climb: the
 * clocks after "october 31st" do not have to follow the ones before it. Tokens that are not clocks
 * are skipped. A clock with no reading at or after the one before it takes its latest reading.
 */
export function placeClocks(tokens: Token[]): Map<string, number> {
  const out = new Map<string, number>()
  let prev: number | null = null
  for (const t of tokens) {
    if (t.kind === "day") {
      prev = null
      continue
    }
    if (t.kind !== "clock") continue
    const options = candidates(t)
    const min: number = prev === null ? firstReading(t, options) : options.find((o) => o >= prev!) ?? options[options.length - 1]!
    out.set(t.id, min)
    prev = min
  }
  return out
}

/** `540` → `9:00 AM`. */
export function clockText(min: number): string {
  const total = ((min % 1440) + 1440) % 1440
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`
}

/** `"17:55"` or `"5:55 pm"` typed in a card, as minutes; null when it is not a clock. */
export function parseTyped(raw: string): number | null {
  const m = /^\s*(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?\s*$/i.exec(raw)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2] ?? 0)
  if (min > 59) return null
  const ap = m[3]?.toLowerCase()
  if (ap) {
    if (h < 1 || h > 12) return null
    h = (h % 12) + (ap === "pm" ? 12 : 0)
  } else if (h > 24) return null
  return (h % 24) * 60 + min
}
