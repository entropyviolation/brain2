/**
 * lib/date-utils.ts — Date helpers (app-wide)
 *
 * Pure date utilities used throughout the app: safe parsing/formatting
 * (`safe*`), YYYY-MM-DD keys (`formatDateKey`), week math
 * (`getWeekStartDate`/`getWeekDates`), scheduler week-range strings
 * (`getWeekString`/`parseWeekString`/`formatWeekRange`), display formatters,
 * `getDayOfWeek`, and `isToday`.
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
  try {
    const [startStr, endStr] = weekString.split("_")
    return {
      start: new Date(startStr),
      end: new Date(endStr),
    }
  } catch {
    return null
  }
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

/** Normalize any date value to local midnight on its calendar day. */
export function toLocalCalendarDate(date: Date | string): Date {
  const d = parseLocalDate(date) ?? (date instanceof Date ? date : new Date(date))
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
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

export function taskScheduledOnDay(task: SchedulableFields, value: Date | string): boolean {
  const compare = parseLocalDate(value)
  if (!compare) return false
  if (task.scheduledDate && sameCalendarDay(task.scheduledDate, compare)) return true
  const deadline = (task as { deadline?: Date | string }).deadline
  return !!deadline && sameCalendarDay(deadline, compare)
}

export function taskScheduledInWeek(task: SchedulableFields, weekValue: string): boolean {
  if (task.scheduledWeek && task.scheduledWeek === weekValue) return true
  const taskDate = safeToDate(task.scheduledDate ?? undefined)
  if (taskDate && getWeekString(taskDate) === weekValue) return true
  const deadline = safeToDate((task as { deadline?: Date | string }).deadline)
  if (deadline && getWeekString(deadline) === weekValue) return true
  // A month-scheduled task surfaces in any week contained in that month.
  if (task.scheduledMonth) {
    const range = parseWeekString(weekValue)
    if (range && range.start.toISOString().slice(0, 7) === task.scheduledMonth) return true
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
    const range = parseWeekString(task.scheduledWeek)
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
    const range = parseWeekString(task.scheduledWeek)
    if (range && range.start.getFullYear().toString() === yearValue) return true
  }
  return false
}

/** True when a task has no scheduling assignment at all. */
export function taskHasNoSchedule(task: SchedulableFields): boolean {
  return !task.scheduledYear && !task.scheduledMonth && !task.scheduledWeek && !task.scheduledDate
}
