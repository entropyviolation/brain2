/**
 * lib/countdown.ts — The Countdown face for one mark (pure)
 *
 * Countdown replaced Days Until and Days Since. It reads one mark from
 * `home-days-until-store.ts` and returns the face: the count, the footer,
 * the caption, and the extras Countdown added. Those are whole units (days,
 * weeks, sleeps, working days), a yearly or monthly repeat that rolls to the
 * next occurrence, a progress fraction from an optional start date, a
 * milestone at round numbers on a count-up, and what a countdown does once
 * it passes. `unit` and `decimal` formats keep today's live face
 * (`daysUntilLiveFace` in `home-widgets.ts`).
 */

import { daysUntilLiveFace, daysUntilRemainingMs } from "@/lib/home-widgets"
import type { HomeDaysUntilItem } from "@/lib/home-days-until-store"

export type CountdownFace = {
  crt: string
  footer: string
  /** "Countdown" while counting toward the mark, "Count up" while counting from it. */
  caption: "Countdown" | "Count up"
  /** The date the face counts to or from, after any repeat. `YYYY-MM-DD`, or "" when unset. */
  date: string
  /** True once the mark has passed (a countdown that stays shows 0). */
  passed: boolean
  /** True when a passed countdown is set to hide its face. */
  hidden: boolean
  /** 0–1 from the start date to the mark, or null without a start. */
  progress: number | null
  /** "100 days", "1 year" on a count-up's round number, else null. */
  milestone: string | null
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 86_400_000

function parse(date: string): Date | null {
  const match = DATE.exec(date.trim())
  if (!match) return null
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

function key(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Calendar days from `from`'s day to `to`'s day (DST-safe). */
export function calendarDayDiff(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((b - a) / MS_PER_DAY)
}

function clampDay(year: number, month: number, day: number): Date {
  const last = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, last))
}

/**
 * The next occurrence of a repeating mark on or after `now`'s day. A
 * February 29 falls on February 28 in other years; a 31st falls on the
 * month's last day.
 */
export function nextOccurrence(date: string, repeat: HomeDaysUntilItem["repeat"], now: Date): string {
  const base = parse(date)
  if (!base || repeat === "none") return date
  const today = startOfDay(now)
  if (base >= today) return date
  if (repeat === "yearly") {
    let next = clampDay(today.getFullYear(), base.getMonth(), base.getDate())
    if (next < today) next = clampDay(today.getFullYear() + 1, base.getMonth(), base.getDate())
    return key(next)
  }
  let next = clampDay(today.getFullYear(), today.getMonth(), base.getDate())
  if (next < today) next = clampDay(today.getFullYear(), today.getMonth() + 1, base.getDate())
  return key(next)
}

/** Weekdays (Mon–Fri) after `from`'s day, up to and including `to`'s day. */
export function workdaysBetween(from: Date, to: Date): number {
  const span = calendarDayDiff(from, to)
  if (span <= 0) return 0
  let count = 0
  const cursor = startOfDay(from)
  for (let i = 0; i < span; i++) {
    cursor.setDate(cursor.getDate() + 1)
    const day = cursor.getDay()
    if (day !== 0 && day !== 6) count++
  }
  return count
}

function plural(n: number, one: string, many: string): string {
  return Math.abs(n) === 1 ? one : many
}

function wholeUnit(format: HomeDaysUntilItem["format"], days: number, from: Date, to: Date): { n: string; unit: string } {
  if (format === "weeks") {
    const weeks = Math.round((days / 7) * 10) / 10
    return { n: String(weeks), unit: plural(weeks, "week", "weeks") }
  }
  if (format === "sleeps") return { n: String(days), unit: plural(days, "sleep", "sleeps") }
  if (format === "workdays") {
    const work = days >= 0 ? workdaysBetween(from, to) : workdaysBetween(to, from)
    return { n: String(work), unit: plural(work, "working day", "working days") }
  }
  return { n: String(days), unit: plural(days, "day", "days") }
}

function milestoneFor(elapsedDays: number, origin: Date, now: Date): string | null {
  if (elapsedDays <= 0) return null
  const years = now.getFullYear() - origin.getFullYear()
  if (years >= 1 && now.getMonth() === origin.getMonth() && now.getDate() === origin.getDate()) {
    return `${years} ${plural(years, "year", "years")}`
  }
  if (elapsedDays % 100 === 0) return `${elapsedDays} days`
  return null
}

export function countdownFace(item: HomeDaysUntilItem, now: Date): CountdownFace {
  const name = item.label.trim() || "that day"
  const date = item.mode === "countup" ? item.date : nextOccurrence(item.date, item.repeat, now)
  const remainingMs = daysUntilRemainingMs(date, item.time, now)
  const target = parse(date)
  const empty: CountdownFace = {
    crt: "—",
    footer: "Set a date",
    caption: item.mode === "countup" ? "Count up" : "Countdown",
    date: "",
    passed: false,
    hidden: false,
    progress: null,
    milestone: null,
  }
  if (remainingMs == null || !target) return empty

  const dayDiff = calendarDayDiff(now, target)
  const isToday = dayDiff === 0 && (!item.time || Math.abs(remainingMs) < 60_000 || remainingMs > 0)
  const passed = item.time ? remainingMs <= 0 : dayDiff < 0
  let mode = item.mode
  if (mode === "countdown" && passed && item.whenPassed === "countup") mode = "auto"
  const hidden = mode === "countdown" && passed && item.whenPassed === "hide"
  const ahead = remainingMs > 0 && !(dayDiff === 0 && !item.time)
  const towards = mode === "countdown" || (mode === "auto" && !passed)
  const caption: CountdownFace["caption"] = mode === "countup" || (mode === "auto" && passed) ? "Count up" : "Countdown"

  let progress: number | null = null
  const start = parse(item.start)
  if (start && towards && !passed) {
    const span = target.getTime() - start.getTime()
    if (span > 0) progress = Math.max(0, Math.min(1, (now.getTime() - start.getTime()) / span))
  }

  const behind = !ahead && !isToday
  const milestone = item.milestones && (mode === "countup" || (mode === "auto" && passed)) && behind
    ? milestoneFor(-dayDiff, target, now)
    : null

  const base = { caption, date, passed, hidden, progress, milestone }

  if (item.format === "unit" || item.format === "decimal") {
    const live = daysUntilLiveFace({
      remainingMs,
      label: item.label,
      format: item.format,
      hasTime: Boolean(item.time),
      mode,
    })
    return { ...base, crt: live.crt, footer: milestone ? `${milestone} · ${live.footer}` : live.footer }
  }

  if (isToday && !(item.time && remainingMs <= 0)) return { ...base, crt: "0", footer: `${name} is today` }
  if (mode === "countdown" && passed) return { ...base, crt: "0", footer: `${name} passed` }
  if (mode === "countup" && ahead) return { ...base, crt: "0", footer: `${name} ahead` }

  const days = Math.abs(dayDiff)
  const unit = ahead ? wholeUnit(item.format, days, now, target) : wholeUnit(item.format, days, target, now)
  const phrase = ahead ? `${unit.unit} until ${name}` : `${unit.unit} since ${name}`
  return { ...base, crt: unit.n, footer: milestone ? `${milestone} · ${phrase}` : phrase }
}
