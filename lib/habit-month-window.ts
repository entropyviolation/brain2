/**
 * lib/habit-month-window.ts — Monthly Habits sheet window
 *
 * One list of month starts (oldest first) for the monthly spreadsheet columns
 * and the monthly span grade. Both call `habitMonthWindowStarts` so the
 * columns and the grade cannot drift. The in-progress month is included.
 * Months after `asOf` are not.
 *
 * Birthday is data (`month` 1–12, `day` 1–31). The default is 5 May.
 */
export const HABIT_MONTH_WINDOW_MODES = ["yearToDate", "trailing12", "sinceBirthday"] as const

export type HabitMonthWindowMode = (typeof HABIT_MONTH_WINDOW_MODES)[number]

export const DEFAULT_HABIT_MONTH_WINDOW: HabitMonthWindowMode = "yearToDate"

export interface HabitBirthday {
  /** Calendar month, 1–12. */
  month: number
  /** Calendar day, 1–31. */
  day: number
}

/** 5 May. Stored so the sheet does not hard-code a birthday. */
export const DEFAULT_HABIT_BIRTHDAY: HabitBirthday = { month: 5, day: 5 }

export const HABIT_MONTH_WINDOW_LABELS: Record<HabitMonthWindowMode, string> = {
  yearToDate: "Year so far",
  trailing12: "12 months",
  sinceBirthday: "Since birthday",
}

export function parseHabitMonthWindowMode(raw: unknown): HabitMonthWindowMode {
  return HABIT_MONTH_WINDOW_MODES.includes(raw as HabitMonthWindowMode)
    ? (raw as HabitMonthWindowMode)
    : DEFAULT_HABIT_MONTH_WINDOW
}

/** Missing or unusable birthday fills 5 May. A real month and day are kept. */
export function sanitizeHabitBirthday(raw: unknown): HabitBirthday {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_HABIT_BIRTHDAY }
  const month = (raw as { month?: unknown }).month
  const day = (raw as { day?: unknown }).day
  if (typeof month !== "number" || !Number.isInteger(month) || month < 1 || month > 12) {
    return { ...DEFAULT_HABIT_BIRTHDAY }
  }
  if (typeof day !== "number" || !Number.isInteger(day) || day < 1 || day > 31) {
    return { ...DEFAULT_HABIT_BIRTHDAY }
  }
  return { month, day }
}

function monthStart(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex, 1)
}

function calendarBirthday(year: number, birthday: HabitBirthday): Date {
  const monthIndex = birthday.month - 1
  const last = new Date(year, monthIndex + 1, 0).getDate()
  return new Date(year, monthIndex, Math.min(birthday.day, last))
}

/** First of the month that holds the most recent birthday on or before `asOf`. */
export function habitBirthdayMonthStart(asOf: Date, birthday: HabitBirthday): Date {
  const day = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate())
  const thisYear = calendarBirthday(day.getFullYear(), birthday)
  const year = thisYear.getTime() <= day.getTime() ? day.getFullYear() : day.getFullYear() - 1
  return monthStart(year, birthday.month - 1)
}

function monthsFrom(start: Date, end: Date): Date[] {
  const out: Date[] = []
  let year = start.getFullYear()
  let month = start.getMonth()
  const endYear = end.getFullYear()
  const endMonth = end.getMonth()
  if (year > endYear || (year === endYear && month > endMonth)) return out
  while (year < endYear || (year === endYear && month <= endMonth)) {
    out.push(monthStart(year, month))
    month += 1
    if (month > 11) {
      month = 0
      year += 1
    }
  }
  return out
}

/**
 * Month starts for the monthly sheet and the span-grade window.
 * Oldest first. Includes the month that contains `asOf`. Stops there.
 */
export function habitMonthWindowStarts(
  asOf: Date,
  mode: HabitMonthWindowMode,
  birthday: HabitBirthday = DEFAULT_HABIT_BIRTHDAY,
): Date[] {
  const end = monthStart(asOf.getFullYear(), asOf.getMonth())
  const resolved = parseHabitMonthWindowMode(mode)
  if (resolved === "trailing12") {
    return monthsFrom(monthStart(end.getFullYear(), end.getMonth() - 11), end)
  }
  if (resolved === "sinceBirthday") {
    return monthsFrom(habitBirthdayMonthStart(asOf, sanitizeHabitBirthday(birthday)), end)
  }
  return monthsFrom(monthStart(end.getFullYear(), 0), end)
}
