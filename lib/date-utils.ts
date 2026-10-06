/**
 * lib/date-utils.ts — Date helpers (app-wide)
 *
 * Pure date utilities used throughout the app: safe parsing/formatting
 * (`safe*`), YYYY-MM-DD keys (`formatDateKey` / `formatLocalDateKey` /
 * `dateKeyOf` / `dateInputValue`), local midnight (`startOfLocalDay` /
 * `toLocalCalendarDate` / `localMidnightFromUtcDateOnly` /
 * `startOfLocalToday` / `endOfLocalDay`), week math
 * (`getWeekStartDate`/`getWeekDates`/`getPrecedingWeekStarts`/`addCalendarDays`),
 * month windows (`getPrecedingMonthStarts`/`getMonthDates`), scheduler
 * week-range strings (`getWeekString`/`parseWeekString`/`formatWeekRange`),
 * display formatters, `getDayOfWeek`, `isToday`, and `isPastLocalCalendarDay`.
 * Period-key identity (day/week/month/quarter/year) lives in `period-keys.ts`
 * so this file does not import `seasons` (seasons already imports date-utils).
 *
 * Spec: supports §7 (Scheduler week ranges) and §9 (habit grid dates).
 */
export function safeDateFormat(date: Date | string | undefined): string {
  if (!date) return "Not set"

  try {
    const dateObj = typeof date === "string" ? new Date(date) : date
    if (isNaN(dateObj.getTime())) return "Invalid date"
    return dateObj.toLocaleDateString()
  } catch {
    return "Invalid date"
  }
}

export function safeISODateString(date: Date | string | undefined): string {
  if (!date) return ""

  try {
    const dateObj = typeof date === "string" ? new Date(date) : date
    if (isNaN(dateObj.getTime())) return ""
    return dateObj.toISOString().split("T")[0]
  } catch {
    return ""
  }
}

export function safeToDate(date: Date | string | undefined): Date | null {
  if (!date) return null

  try {
    const dateObj = typeof date === "string" ? new Date(date) : date
    if (isNaN(dateObj.getTime())) return null
    return dateObj
  } catch {
    return null
  }
}

export function formatWeekRange(startDate: Date): string {
  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + 6)

  const startMonth = startDate.getMonth() + 1
  const startDay = startDate.getDate()
  const endMonth = endDate.getMonth() + 1
  const endDay = endDate.getDate()

  return `${startMonth}/${startDay}-${endMonth}/${endDay}`
}

/** Week range string using Monday as week start (matches getWeekStartDate). */
export function getWeekString(date: Date): string {
  const start = getWeekStartDate(date)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(0, 0, 0, 0)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  return `${fmt(start)}_${fmt(end)}`
}

export function parseWeekString(weekString: string): { start: Date; end: Date } | null {
  if (!weekString) return null
  const [startStr, endStr] = weekString.split("_")
  if (!startStr || !endStr) return null
  const start = parseLocalDate(startStr)
  const end = parseLocalDate(endStr)
  if (!start || !end) return null
  return { start, end }
}

/**
 * Gets the Monday of the week containing the given date
 */
export function getWeekStartDate(date: Date): Date {
  const day = date.getDay()
  // Convert Sunday (0) to 7 to make Monday (1) the first day of the week
  const diff = date.getDate() - (day === 0 ? 6 : day - 1)
  const monday = new Date(date)
  monday.setDate(diff)
  // Reset time to start of day
  monday.setHours(0, 0, 0, 0)
  return monday
}

/**
 * Gets an array of 7 dates for the week starting with the given date
 */
export function getWeekDates(startDate: Date): Date[] {
  const dates: Date[] = []
  const currentDate = new Date(startDate)

  for (let i = 0; i < 7; i++) {
    dates.push(new Date(currentDate))
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return dates
}

/** Monday of each of the `count` weeks ending at `weekStart` (oldest first). */
export function getPrecedingWeekStarts(weekStart: Date, count = 7): Date[] {
  const start = getWeekStartDate(weekStart)
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() - 7 * (count - 1 - i))
    d.setHours(0, 0, 0, 0)
    return d
  })
}

/** First of each of the `count` months ending at `date`'s month (oldest first). */
export function getPrecedingMonthStarts(date: Date, count = 7): Date[] {
  const y = date.getFullYear()
  const m = date.getMonth()
  return Array.from({ length: count }, (_, i) => new Date(y, m - (count - 1 - i), 1))
}

/** Every local calendar date in the month containing `date`. */
export function getMonthDates(date: Date): Date[] {
  const y = date.getFullYear()
  const m = date.getMonth()
  const n = new Date(y, m + 1, 0).getDate()
  return Array.from({ length: n }, (_, i) => new Date(y, m, i + 1))
}

export function addCalendarDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Monday–Sunday key for a stored week range.
 * A `getWeekString` value passes through. An older Sunday-start range (the
 * month grid used to draw those) maps through its Wednesday, so it still
 * names the week the funnel shows.
 */
export function canonicalWeekKey(weekString: string): string {
  const range = parseWeekString(weekString)
  if (!range) return weekString
  return getWeekString(addCalendarDays(range.start, 3))
}

/** True when two week ranges are the same Monday–Sunday week. */
export function sameWeekKey(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return a === b || canonicalWeekKey(a) === canonicalWeekKey(b)
}

export function isSameLocalWeek(a: Date, b: Date): boolean {
  return getWeekString(a) === getWeekString(b)
}

export function isSameLocalMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

/**
 * Formats a date as YYYY-MM-DD for use as a key in the data structure
 */
/** Formats a date as YYYY-MM-DD (UTC-based; used for schedule keys). */
export function formatDateKey(date: Date): string {
  return date.toISOString().split("T")[0]
}

/** Local calendar date key (YYYY-MM-DD) — avoids UTC drift for habit completions. */
export function formatLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

/** Local calendar month key (YYYY-MM). */
export function formatLocalMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

/** True when two values fall on the same local calendar day. */
export function sameCalendarDay(a: Date | string | null | undefined, b: Date): boolean {
  const da = parseLocalDate(a)
  if (!da) return false
  return formatLocalDateKey(da) === formatLocalDateKey(b)
}

/**
 * Local YYYY-MM-DD for a Date or parseable string, or null when missing/invalid.
 * Prefer this over hand-rolled `formatLocalDateKey(parseLocalDate(...))`.
 */
export function dateKeyOf(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const parsed = parseLocalDate(value)
  if (!parsed || Number.isNaN(parsed.getTime())) return null
  return formatLocalDateKey(parsed)
}

/** Value for `<input type="date">`: local YYYY-MM-DD, or "" when missing. */
export function dateInputValue(value: Date | string | null | undefined): string {
  return dateKeyOf(value) ?? ""
}

/** Normalize any date value to local midnight on its calendar day. */
export function toLocalCalendarDate(date: Date | string): Date {
  const d = parseLocalDate(date) ?? (date instanceof Date ? date : new Date(date))
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * Canonical local-midnight helper. Same as `toLocalCalendarDate`; prefer this
 * name at call sites that previously inlined `new Date(y, m, d)`.
 */
export function startOfLocalDay(date: Date | string): Date {
  return toLocalCalendarDate(date)
}

/** Last millisecond of the local calendar day containing `date`. */
export function endOfLocalDay(date: Date | string): Date {
  const d = toLocalCalendarDate(date)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

/** Local midnight of the current calendar day (`now`, default wall clock). */
export function startOfLocalToday(now: Date = new Date()): Date {
  return startOfLocalDay(now)
}

/**
 * True when `day` is strictly before local today. Independent of any selected
 * or viewed date. Today is never past.
 */
export function isPastLocalCalendarDay(day: Date | string, now: Date = new Date()): boolean {
  return toLocalCalendarDate(day).getTime() < startOfLocalToday(now).getTime()
}

/**
 * Formats a date for display in the UI (e.g., "Mon 5/16")
 */
export function formatDateDisplay(date: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const day = days[date.getDay()]
  const month = date.getMonth() + 1
  const dayOfMonth = date.getDate()

  return `${day} ${month}/${dayOfMonth}`
}

/**
 * Formats a date range for display (e.g., "May 15 - May 21, 2023")
 */
export function formatDateRange(startDate: Date, endDate: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: startDate.getFullYear() !== endDate.getFullYear() ? "numeric" : undefined,
  }

  const start = startDate.toLocaleDateString("en-US", options)
  const end = endDate.toLocaleDateString("en-US", {
    ...options,
    year: "numeric", // Always show year for end date
  })

  return `${start} - ${end}`
}

/**
 * Gets the day of week name for a date
 */
export function getDayOfWeek(date: Date): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  return days[date.getDay()]
}

/**
 * Checks if a date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

/**
 * Minimal shape of the Scheduler's scheduling fields on a task. Kept loose so
 * both the Scheduler and the To-Do/Plan panels can share period membership
 * logic without depending on the full Task type.
 */
export interface SchedulableFields {
  scheduledDate?: Date | string | null
  scheduledWeek?: string | null
  scheduledMonth?: string | null
  scheduledYear?: string | null
}

/**
 * The following helpers answer "is this task scheduled within this period?",
 * honouring the most specific scheduling field set on the task. A task placed
 * on a specific day also counts as scheduled in that week, month and year; a
 * week-scheduled task counts within its month and year, etc. This keeps the
 * Scheduler's funnel boxes and the To-Do/Plan day-week-month views in sync.
 *
 * `value` strings use the exact representations the Scheduler stores:
 *   year  → "YYYY"
 *   month → "YYYY-MM"   (ISO month slice)
 *   week  → "YYYY-MM-DD_YYYY-MM-DD" (see getWeekString)
 *   day   → a Date or ISO date string
 */
/**
 * Parse a value to a Date using LOCAL time for bare "YYYY-MM-DD" strings.
 * `new Date("2026-06-11")` is interpreted as UTC midnight, which lands on the
 * previous calendar day in negative-offset timezones; this avoids that drift so
 * day comparisons agree across the Scheduler and the To-Do/Plan panels.
 */
export function parseLocalDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return safeToDate(value)
}

/**
 * `<input type="date">` used to be stored with `new Date("YYYY-MM-DD")`, which
 * is UTC midnight. The day the person picked is that UTC date. A timestamp
 * with any other time is a real instant and is returned unchanged.
 */
export function localMidnightFromUtcDateOnly(value: Date): Date {
  if (Number.isNaN(value.getTime())) return value
  if (
    value.getUTCHours() !== 0 ||
    value.getUTCMinutes() !== 0 ||
    value.getUTCSeconds() !== 0 ||
    value.getUTCMilliseconds() !== 0
  ) {
    return value
  }
  const local = new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
  return local.getTime() === value.getTime() ? value : local
}

export function taskScheduledOnDay(task: SchedulableFields, value: Date | string): boolean {
  const compare = parseLocalDate(value)
  if (!compare) return false
  if (task.scheduledDate && sameCalendarDay(task.scheduledDate, compare)) return true
  const deadline = (task as { deadline?: Date | string }).deadline
  return !!deadline && sameCalendarDay(deadline, compare)
}

export function taskScheduledInWeek(task: SchedulableFields, weekValue: string): boolean {
  if (task.scheduledWeek && sameWeekKey(task.scheduledWeek, weekValue)) return true
  const taskDate = safeToDate(task.scheduledDate ?? undefined)
  if (taskDate && getWeekString(taskDate) === weekValue) return true
  const deadline = safeToDate((task as { deadline?: Date | string }).deadline)
  if (deadline && getWeekString(deadline) === weekValue) return true
  // A month-scheduled task surfaces in any week whose Monday falls in that month.
  if (task.scheduledMonth) {
    const range = parseWeekString(weekValue)
    if (range && formatLocalMonthKey(range.start) === task.scheduledMonth) return true
  }
  return false
}

export function taskScheduledInMonth(task: SchedulableFields, monthValue: string): boolean {
  if (task.scheduledMonth && task.scheduledMonth === monthValue) return true
  const taskDate = parseLocalDate(task.scheduledDate ?? undefined)
  if (taskDate && formatLocalMonthKey(taskDate) === monthValue) return true
  const deadline = parseLocalDate((task as { deadline?: Date | string }).deadline)
  if (deadline && formatLocalMonthKey(deadline) === monthValue) return true
  if (task.scheduledWeek) {
    const range = parseWeekString(canonicalWeekKey(task.scheduledWeek))
    if (range && formatLocalMonthKey(range.start) === monthValue) return true
  }
  return false
}

export function taskScheduledInYear(task: SchedulableFields, yearValue: string): boolean {
  if (task.scheduledYear && task.scheduledYear === yearValue) return true
  const taskDate = safeToDate(task.scheduledDate ?? undefined)
  if (taskDate && taskDate.getFullYear().toString() === yearValue) return true
  const deadline = safeToDate((task as { deadline?: Date | string }).deadline)
  if (deadline && deadline.getFullYear().toString() === yearValue) return true
  if (task.scheduledMonth && task.scheduledMonth.slice(0, 4) === yearValue) return true
  if (task.scheduledYear === undefined && task.scheduledWeek) {
    const range = parseWeekString(canonicalWeekKey(task.scheduledWeek))
    if (range && range.start.getFullYear().toString() === yearValue) return true
  }
  return false
}

/** True when a task has no scheduling assignment at all. */
export function taskHasNoSchedule(task: SchedulableFields): boolean {
  return !task.scheduledYear && !task.scheduledMonth && !task.scheduledWeek && !task.scheduledDate
}
