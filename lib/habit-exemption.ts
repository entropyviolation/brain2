/**
 * lib/habit-exemption.ts — Exemption wand
 *
 * A period can be lifted out of a habit's requirement without counting as done.
 * Days, weeks, and months that end before the habit existed are exempt on
 * their own. The creation day is `createdAt` when it was stored, otherwise the
 * `task-{unix ms}` id stamped at add time. Seed ids such as `task-1` are not
 * a date. A wand click stores an explicit override (`true` waive, `false`
 * require) and clears it when the choice matches that automatic rule again.
 *
 * Daily habits can also carry log blocks (`WeeklyTask.logExemptions`). An
 * all-nighter is keyed by the morning date. `evening-before` lifts the day
 * that led into that night; `morning-of` lifts that morning. `undefined`
 * blocks use the name preset (bedtime + 11, wake + 9, document + dream).
 * An empty array means the user cleared the preset. Weekly and monthly
 * ignore log blocks. An explicit require (`false`) beats a log block.
 *
 * Scoring drops an exempt period from both sides of the fraction: three daily
 * habits with one waived divide by two; a week with one waived day divides by
 * six. The waived day is not a completion.
 */
import type { HabitFrequency, HabitLogDay, HabitLogExemption, HabitLogSignal, WeeklyTask } from "./types"
import { addCalendarDays, formatLocalDateKey, parseLocalDate } from "./date-utils"

/** period key → habit id → explicit override. `true` waives, `false` requires. */
export type ExemptionBook = Record<string, Record<string, boolean>>

export type ExemptionBooks = Record<HabitFrequency, ExemptionBook>

export type ExemptionKind = "required" | "auto" | "waved" | "logged"

export type ExemptionTask = Pick<WeeklyTask, "id" | "createdAt" | "name" | "frequency" | "logExemptions">

/** Nights already logged as all-nighters, keyed by morning date. */
export type ExemptionContext = {
  allNighterMornings: ReadonlySet<string>
}

const LOG_SIGNALS = new Set<HabitLogSignal>(["all-nighter"])
const LOG_DAYS = new Set<HabitLogDay>(["evening-before", "morning-of"])

export function sanitizeLogExemptions(value: unknown): HabitLogExemption[] {
  if (!Array.isArray(value)) return []
  const out: HabitLogExemption[] = []
  const seen = new Set<string>()
  for (const row of value) {
    if (!row || typeof row !== "object") continue
    const when = (row as HabitLogExemption).when
    const day = (row as HabitLogExemption).day
    if (!LOG_SIGNALS.has(when) || !LOG_DAYS.has(day)) continue
    const key = `${when}:${day}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ when, day })
  }
  return out
}

/** Name preset used only while `logExemptions` is still unset. */
export function presetLogExemptions(
  task: Pick<WeeklyTask, "name" | "frequency">,
): HabitLogExemption[] {
  if (task.frequency && task.frequency !== "daily") return []
  const name = (task.name || "").toLowerCase()
  const blocks: HabitLogExemption[] = []
  if (name.includes("bedtime") && name.includes("11")) {
    blocks.push({ when: "all-nighter", day: "evening-before" })
  }
  if (name.includes("wake") && /\b9\b/.test(name)) {
    blocks.push({ when: "all-nighter", day: "morning-of" })
  }
  if (name.includes("document") && name.includes("dream")) {
    blocks.push({ when: "all-nighter", day: "morning-of" })
  }
  return blocks
}

/** Stored blocks, or the name preset when the habit has never saved any. */
export function effectiveLogExemptions(
  task: Pick<WeeklyTask, "name" | "frequency" | "logExemptions">,
): HabitLogExemption[] {
  if (Array.isArray(task.logExemptions)) return sanitizeLogExemptions(task.logExemptions)
  return presetLogExemptions(task)
}

export function allNighterMorningSet(
  nights: Record<string, { allNighter?: boolean } | undefined> | undefined,
): Set<string> {
  const set = new Set<string>()
  if (!nights) return set
  for (const [key, night] of Object.entries(nights)) {
    if (night?.allNighter) set.add(key)
  }
  return set
}

export function exemptionContext(
  nights: Record<string, { allNighter?: boolean } | undefined> | undefined,
): ExemptionContext {
  return { allNighterMornings: allNighterMorningSet(nights) }
}

type NightReader = () => Record<string, { allNighter?: boolean } | undefined>
let readNights: NightReader = () => ({})

/** Sleep store binds this so non-React callers see the live log. */
export function bindAllNighterNights(read: NightReader) {
  readNights = read
}

export function currentExemptionContext(): ExemptionContext {
  return exemptionContext(readNights())
}

const allNighterListeners = new Set<(morningKey: string) => void>()

export function onAllNighterLogged(fn: (morningKey: string) => void): () => void {
  allNighterListeners.add(fn)
  return () => {
    allNighterListeners.delete(fn)
  }
}

export function notifyAllNighterLogged(morningKey: string) {
  for (const fn of allNighterListeners) {
    try {
      fn(morningKey)
    } catch (err) {
      console.error("[habit-exemption] all-nighter resync", err)
    }
  }
}

export function isExemptKind(kind: ExemptionKind | null | undefined): boolean {
  return kind === "auto" || kind === "waved" || kind === "logged"
}

function resolveContext(ctx?: ExemptionContext): ExemptionContext {
  return ctx ?? currentExemptionContext()
}

/** The log day that lifts this period, if one does. Weekly and monthly never match. */
export function loggedExemptionDay(
  task: Pick<WeeklyTask, "name" | "frequency" | "logExemptions">,
  periodKey: string,
  frequency: HabitFrequency,
  ctx?: ExemptionContext,
): HabitLogDay | null {
  if (frequency !== "daily") return null
  const mornings = resolveContext(ctx).allNighterMornings
  if (mornings.size === 0) return null
  for (const block of effectiveLogExemptions(task)) {
    if (block.when !== "all-nighter") continue
    if (block.day === "morning-of" && mornings.has(periodKey)) return "morning-of"
    if (block.day === "evening-before") {
      const next = shiftKey(periodKey, 1)
      if (next && mornings.has(next)) return "evening-before"
    }
  }
  return null
}

export function describeAllNighterLifts(
  tasks: Pick<WeeklyTask, "name" | "frequency" | "logExemptions">[],
): { name: string; day: HabitLogDay }[] {
  const rows: { name: string; day: HabitLogDay }[] = []
  for (const task of tasks) {
    if (task.frequency && task.frequency !== "daily") continue
    const name = task.name?.trim() || "Untitled habit"
    for (const block of effectiveLogExemptions(task)) {
      if (block.when !== "all-nighter") continue
      rows.push({ name, day: block.day })
    }
  }
  return rows
}

function loggedPhrase(day: HabitLogDay | null): string {
  if (day === "evening-before") return "all-nighter that night"
  if (day === "morning-of") return "all-nighter that morning"
  return "all-nighter"
}

export function exemptionRestLabel(
  name: string,
  periodLabel: string,
  kind: ExemptionKind,
  logDay: HabitLogDay | null,
): string {
  if (kind === "auto") return `${name} ${periodLabel} exempt — before this habit was created`
  if (kind === "logged") return `${name} ${periodLabel} exempt — ${loggedPhrase(logDay)}`
  if (kind === "waved") return `${name} ${periodLabel} exempt`
  return `${name} ${periodLabel}`
}

export function exemptionWandTitle(kind: ExemptionKind, noun: "day" | "week" | "month", logDay: HabitLogDay | null): string {
  if (kind === "auto") {
    return noun === "day"
      ? "Exempt — this day is before the habit was created. Click to require it."
      : `Exempt — this ${noun} ended before the habit was created. Click to require it.`
  }
  if (kind === "logged") return `Exempt — ${loggedPhrase(logDay)}. Click to require this ${noun}.`
  if (kind === "waved") return `Exempt. Click to require this ${noun} again.`
  return `Required. Click to exempt this ${noun}.`
}

export function exemptionHeatTitle(name: string, kind: ExemptionKind, logDay: HabitLogDay | null): string {
  if (!isExemptKind(kind)) return `${name} · required`
  if (kind === "auto") return `${name} · exempt before it was created`
  if (kind === "logged") return `${name} · exempt — ${loggedPhrase(logDay)}`
  return `${name} · exempt`
}

export function emptyExemptionBooks(): ExemptionBooks {
  return { daily: {}, weekly: {}, monthly: {} }
}

function sanitizeBook(value: unknown): ExemptionBook {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const book: ExemptionBook = {}
  for (const [periodKey, row] of Object.entries(value as Record<string, unknown>)) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue
    const cells: Record<string, boolean> = {}
    for (const [taskId, flag] of Object.entries(row as Record<string, unknown>)) {
      if (flag === true || flag === false) cells[taskId] = flag
    }
    if (Object.keys(cells).length > 0) book[periodKey] = cells
  }
  return book
}

export function sanitizeExemptionBooks(value: unknown): ExemptionBooks {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return {
    daily: sanitizeBook(raw.daily),
    weekly: sanitizeBook(raw.weekly),
    monthly: sanitizeBook(raw.monthly),
  }
}

export function exemptionBooksEmpty(books: ExemptionBooks | undefined): boolean {
  if (!books) return true
  return (
    Object.keys(books.daily || {}).length === 0 &&
    Object.keys(books.weekly || {}).length === 0 &&
    Object.keys(books.monthly || {}).length === 0
  )
}

/** Unix ms baked into `task-${Date.now()}` ids. Seed ids (`task-1`) do not match. */
export function stampedHabitCreatedMs(id: string | undefined): number | null {
  const stamped = /^task-(\d{10,})$/.exec(id ?? "")
  if (!stamped) return null
  const ms = Number(stamped[1])
  return Number.isFinite(ms) ? ms : null
}

/**
 * Local calendar day the habit began.
 * `createdAt` wins. Habits added before that field existed still carry the
 * instant in their id. Neither source → no automatic waiver.
 */
export function habitCreatedKey(task: Pick<WeeklyTask, "id" | "createdAt">): string | null {
  if (task.createdAt) {
    const parsed = parseLocalDate(task.createdAt) ?? new Date(task.createdAt)
    if (!Number.isNaN(parsed.getTime())) return formatLocalDateKey(parsed)
  }
  const ms = stampedHabitCreatedMs(task.id)
  if (ms == null) return null
  const parsed = new Date(ms)
  if (Number.isNaN(parsed.getTime())) return null
  return formatLocalDateKey(parsed)
}

/** Period start encoded in a daily / weekly / monthly completion key. */
export function periodStartFromKey(frequency: HabitFrequency, periodKey: string): Date | null {
  if (frequency === "daily") return parseLocalDate(periodKey)
  if (frequency === "weekly") return parseLocalDate(periodKey.split("_")[0])
  const month = /^(\d{4})-(\d{2})$/.exec(periodKey)
  if (!month) return null
  return new Date(Number(month[1]), Number(month[2]) - 1, 1)
}

/** Last local day of the period. `periodStart` is the day, the Monday, or the 1st. */
export function periodEndKey(periodStart: Date, frequency: HabitFrequency): string {
  if (frequency === "daily") return formatLocalDateKey(periodStart)
  if (frequency === "weekly") return formatLocalDateKey(addCalendarDays(periodStart, 6))
  const end = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0)
  return formatLocalDateKey(end)
}

/**
 * The habit did not exist for any part of this period.
 * The creation day, the week that contains it, and the month that contains it stay required.
 */
export function isAutoExempt(task: Pick<WeeklyTask, "id" | "createdAt">, periodStart: Date, frequency: HabitFrequency): boolean {
  const created = habitCreatedKey(task)
  if (!created) return false
  return periodEndKey(periodStart, frequency) < created
}

export function exemptionKind(
  task: ExemptionTask,
  periodKey: string,
  frequency: HabitFrequency,
  books: ExemptionBooks,
  ctx?: ExemptionContext,
): ExemptionKind {
  const override = books[frequency]?.[periodKey]?.[task.id]
  if (override === true) return "waved"
  if (override === false) return "required"
  const start = periodStartFromKey(frequency, periodKey)
  if (!start) return "required"
  if (isAutoExempt(task, start, frequency)) return "auto"
  if (loggedExemptionDay(task, periodKey, frequency, ctx)) return "logged"
  return "required"
}

export function exemptionTest(books: ExemptionBooks, frequency: HabitFrequency, ctx?: ExemptionContext) {
  return (task: ExemptionTask, periodKey: string) =>
    isHabitPeriodExempt(task, periodKey, frequency, books, ctx)
}

export function isHabitPeriodExempt(
  task: ExemptionTask,
  periodKey: string,
  frequency: HabitFrequency,
  books: ExemptionBooks,
  ctx?: ExemptionContext,
): boolean {
  const kind = exemptionKind(task, periodKey, frequency, books, ctx)
  return isExemptKind(kind)
}

/** Write the wand click. Matching the automatic rule (creation or a log block) drops the override. */
export function withExemptionOverride(
  books: ExemptionBooks,
  frequency: HabitFrequency,
  periodKey: string,
  task: ExemptionTask,
  exempt: boolean,
  ctx?: ExemptionContext,
): ExemptionBooks {
  const start = periodStartFromKey(frequency, periodKey)
  const auto =
    (start ? isAutoExempt(task, start, frequency) : false) ||
    loggedExemptionDay(task, periodKey, frequency, ctx) != null
  const book = { ...(books[frequency] || {}) }
  const row = { ...(book[periodKey] || {}) }
  if (exempt === auto) delete row[task.id]
  else row[task.id] = exempt
  if (Object.keys(row).length === 0) delete book[periodKey]
  else book[periodKey] = row
  return { ...books, [frequency]: book }
}

export function stripTaskExemptions(books: ExemptionBooks, taskId: string): ExemptionBooks {
  const next = emptyExemptionBooks()
  for (const frequency of ["daily", "weekly", "monthly"] as const) {
    for (const [periodKey, row] of Object.entries(books[frequency] || {})) {
      if (!row) continue
      const cells = { ...row }
      delete cells[taskId]
      if (Object.keys(cells).length > 0) next[frequency][periodKey] = cells
    }
  }
  return next
}

function shiftKey(key: string, days: number): string | null {
  const date = parseLocalDate(key)
  if (!date) return null
  return formatLocalDateKey(addCalendarDays(date, days))
}

/**
 * Completion streak that treats exempt days as absent from the calendar:
 * they do not add a day and they do not break the run. Unfinished today still
 * gets the one-day grace the ordinary streak uses.
 */
export function streakSkippingExemptDays(
  metKeys: string[],
  isExempt: (key: string) => boolean,
  today: Date,
): { current: number; longest: number } {
  const met = new Set(metKeys)
  const keys = [...met].filter((key) => parseLocalDate(key)).sort()
  if (keys.length === 0) return { current: 0, longest: 0 }
  const todayKey = formatLocalDateKey(today)
  const last = todayKey > keys[keys.length - 1] ? todayKey : keys[keys.length - 1]
  let cursor = keys[0]
  let run = 0
  let longest = 0
  while (cursor && cursor <= last) {
    if (met.has(cursor)) {
      run += 1
      if (run > longest) longest = run
    } else if (!isExempt(cursor)) {
      run = 0
    }
    cursor = shiftKey(cursor, 1) ?? ""
  }

  let probe = todayKey
  if (!met.has(probe) && !isExempt(probe)) probe = shiftKey(probe, -1) ?? ""
  let current = 0
  while (probe && probe >= keys[0]) {
    if (met.has(probe)) current += 1
    else if (!isExempt(probe)) break
    probe = shiftKey(probe, -1) ?? ""
  }
  return { current, longest }
}
