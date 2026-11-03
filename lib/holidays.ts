/**
 * lib/holidays.ts — Major US holidays as generated, read-only calendar events
 *
 * The set Apple's "US Holidays" calendar shows, computed from rules (no network,
 * nothing persisted). Ids are `holiday-<slug>-<year>`, so they never collide with
 * stored events and `isHolidayEvent` can tell them apart. Plan reads them through
 * `withHolidays`; the BIM snapshot and the day read do the same, so a phrase like
 * "before Christmas" resolves against a dated event.
 */
import type { CalendarEvent } from "./types"

export const HOLIDAY_COLOR = "#c9a0dc"
const ID_PREFIX = "holiday-"

type Rule = { slug: string; title: string; on: (year: number) => [month: number, day: number] }

/** Nth (1-based) given weekday (0=Sun) of a month; n = -1 means the last one. */
function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  if (n > 0) {
    const first = new Date(year, month - 1, 1).getDay()
    return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7
  }
  const last = new Date(year, month, 0)
  return last.getDate() - ((last.getDay() - weekday + 7) % 7)
}

/** Western Easter Sunday (anonymous Gregorian algorithm). */
function easter(year: number): [number, number] {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return [month, day]
}

/** First day of Hanukkah (25 Kislev), found by walking Nov 20 – Dec 31 on the Hebrew calendar. */
function hanukkah(year: number): [number, number] {
  const hebrew = new Intl.DateTimeFormat("en-u-ca-hebrew", { month: "long", day: "numeric" })
  for (let d = new Date(year, 10, 20); d.getFullYear() === year; d.setDate(d.getDate() + 1)) {
    const parts = hebrew.formatToParts(d)
    const month = parts.find((p) => p.type === "month")?.value
    const day = parts.find((p) => p.type === "day")?.value
    if (month === "Kislev" && day === "25") return [d.getMonth() + 1, d.getDate()]
  }
  return [12, 25]
}

const RULES: Rule[] = [
  { slug: "new-years-day", title: "New Year's Day", on: () => [1, 1] },
  { slug: "mlk-day", title: "Martin Luther King Jr. Day", on: (y) => [1, nthWeekday(y, 1, 1, 3)] },
  { slug: "valentines-day", title: "Valentine's Day", on: () => [2, 14] },
  { slug: "presidents-day", title: "Presidents' Day", on: (y) => [2, nthWeekday(y, 2, 1, 3)] },
  { slug: "st-patricks-day", title: "St. Patrick's Day", on: () => [3, 17] },
  { slug: "easter", title: "Easter", on: easter },
  { slug: "mothers-day", title: "Mother's Day", on: (y) => [5, nthWeekday(y, 5, 0, 2)] },
  { slug: "memorial-day", title: "Memorial Day", on: (y) => [5, nthWeekday(y, 5, 1, -1)] },
  { slug: "juneteenth", title: "Juneteenth", on: () => [6, 19] },
  { slug: "fathers-day", title: "Father's Day", on: (y) => [6, nthWeekday(y, 6, 0, 3)] },
  { slug: "independence-day", title: "Independence Day", on: () => [7, 4] },
  { slug: "labor-day", title: "Labor Day", on: (y) => [9, nthWeekday(y, 9, 1, 1)] },
  { slug: "columbus-day", title: "Columbus Day", on: (y) => [10, nthWeekday(y, 10, 1, 2)] },
  { slug: "halloween", title: "Halloween", on: () => [10, 31] },
  { slug: "veterans-day", title: "Veterans Day", on: () => [11, 11] },
  { slug: "thanksgiving", title: "Thanksgiving", on: (y) => [11, nthWeekday(y, 11, 4, 4)] },
  { slug: "hanukkah", title: "Hanukkah", on: hanukkah },
  { slug: "christmas-eve", title: "Christmas Eve", on: () => [12, 24] },
  { slug: "christmas", title: "Christmas Day", on: () => [12, 25] },
  { slug: "new-years-eve", title: "New Year's Eve", on: () => [12, 31] },
]

function holidayEvent(rule: Rule, year: number): CalendarEvent {
  const [month, day] = rule.on(year)
  return {
    id: `${ID_PREFIX}${rule.slug}-${year}`,
    title: rule.title,
    startTime: "00:00",
    endTime: "23:59",
    date: new Date(year, month - 1, day),
    type: "event",
    color: HOLIDAY_COLOR,
    isScheduled: true,
    isAllDay: true,
    description: "US holiday",
  }
}

export function isHolidayEvent(event: Pick<CalendarEvent, "id">): boolean {
  return event.id.startsWith(ID_PREFIX)
}

/** Every holiday in the inclusive year range, in date order. */
export function holidaysForYears(fromYear: number, toYear: number): CalendarEvent[] {
  const out: CalendarEvent[] = []
  for (let year = fromYear; year <= toYear; year++) {
    for (const rule of RULES) out.push(holidayEvent(rule, year))
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime())
}

/** Stored events plus holidays for the years around `around` (default: this year, ±1). */
export function withHolidays(events: CalendarEvent[], around: Date = new Date(), span = 1): CalendarEvent[] {
  const year = around.getFullYear()
  const stored = events.filter((event) => !isHolidayEvent(event))
  return [...stored, ...holidaysForYears(year - span, year + span)]
}
