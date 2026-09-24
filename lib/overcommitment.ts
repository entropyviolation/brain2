/**
 * lib/overcommitment.ts — Classical load early-warning (#238)
 *
 * Two daily series over a caller-supplied date window (the shared Analytics
 * range): reconstructed day-pushes from `Task.daysPushed`, and logged minutes
 * from `timeLogs`. Trend, rolling slope, and change-points come from
 * `lib/metrics.ts`. Nothing here reschedules a day.
 */
import { formatLocalDateKey, parseLocalDate } from "@/lib/date-utils"
import {
  detectChangePoints,
  rollingSlope,
  trend,
  type ChangePoint,
  type RollingSlopePoint,
  type SeriesPoint,
  type TrendResult,
} from "@/lib/metrics"
import type { Task } from "@/lib/types"

/** Observed days with activity below this are too thin to treat as a finding. */
export const OVERCOMMITMENT_SAMPLE_FLOOR = 7

const MINUTES_SLOPE_EPS = 1
const PUSH_SLOPE_EPS = 0.05
const ROLLING_WINDOW = 7

export type OvercommitmentTask = Pick<
  Task,
  "id" | "daysPushed" | "scheduledDate" | "completedDate" | "timeLogs"
>

export type OvercommitmentStatus = "empty" | "thin" | "ok"

export interface OvercommitmentReport {
  status: OvercommitmentStatus
  warning: boolean
  n: number
  floor: number
  sentence: string
  minutes: SeriesPoint[]
  pushes: SeriesPoint[]
  minutesTrend: TrendResult
  pushTrend: TrendResult
  minutesChangePoints: ChangePoint[]
  pushChangePoints: ChangePoint[]
  minutesRolling: RollingSlopePoint[]
  pushRolling: RollingSlopePoint[]
  minutesShift: ChangePoint | null
  pushShift: ChangePoint | null
  pushedTaskIds: string[]
  loggedTaskIds: string[]
}

function shiftDateKey(key: string, deltaDays: number): string | null {
  const d = parseLocalDate(key)
  if (!d) return null
  d.setDate(d.getDate() + deltaDays)
  return formatLocalDateKey(d)
}

function dateKeyOf(value: Date | string | null | undefined): string | null {
  const d = parseLocalDate(value)
  if (!d || Number.isNaN(d.getTime())) return null
  return formatLocalDateKey(d)
}

/**
 * Place each day-push on the calendar day it most likely happened.
 * `pushTaskOnePeriod` walks the due date forward one day at a time, so
 * `daysPushed = k` with end date E means pushes on E−k … E−1.
 */
export function reconstructPushDates(
  task: OvercommitmentTask,
  today: Date = new Date(),
): string[] {
  const count = Math.max(0, Math.floor(task.daysPushed ?? 0))
  if (count === 0) return []
  const end =
    dateKeyOf(task.scheduledDate) ?? dateKeyOf(task.completedDate) ?? formatLocalDateKey(today)
  const out: string[] = []
  for (let k = 1; k <= count; k++) {
    const key = shiftDateKey(end, -k)
    if (key) out.push(key)
  }
  return out
}

export function dailyPushCounts(
  tasks: OvercommitmentTask[],
  dateKeys: readonly string[],
  today: Date = new Date(),
): SeriesPoint[] {
  const keySet = new Set(dateKeys)
  const counts = new Map<string, number>()
  for (const key of dateKeys) counts.set(key, 0)
  for (const task of tasks) {
    for (const key of reconstructPushDates(task, today)) {
      if (keySet.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return dateKeys.map((date) => ({ date, value: counts.get(date) ?? 0 }))
}

export function dailyLoggedMinutes(
  tasks: OvercommitmentTask[],
  dateKeys: readonly string[],
): SeriesPoint[] {
  const keySet = new Set(dateKeys)
  const minutes = new Map<string, number>()
  for (const key of dateKeys) minutes.set(key, 0)
  for (const task of tasks) {
    for (const log of task.timeLogs ?? []) {
      if (!keySet.has(log.date)) continue
      const dur = Number(log.durationMinutes)
      if (!Number.isFinite(dur) || dur <= 0) continue
      minutes.set(log.date, (minutes.get(log.date) ?? 0) + dur)
    }
  }
  return dateKeys.map((date) => ({ date, value: minutes.get(date) ?? 0 }))
}

function observedN(minutes: SeriesPoint[], pushes: SeriesPoint[]): number {
  let n = 0
  for (let i = 0; i < minutes.length; i++) {
    if ((minutes[i]?.value ?? 0) > 0 || (pushes[i]?.value ?? 0) > 0) n++
  }
  return n
}

function latestUpward(cps: ChangePoint[]): ChangePoint | null {
  for (let i = cps.length - 1; i >= 0; i--) {
    if (cps[i].delta > 0) return cps[i]
  }
  return null
}

function lastSlope(points: RollingSlopePoint[]): number | undefined {
  return points.length ? points[points.length - 1].slope : undefined
}

function isRising(fit: TrendResult, slope: number | undefined, shift: ChangePoint | null, epsilon: number): boolean {
  if (fit.direction === "rising") return true
  if (slope !== undefined && slope > epsilon) return true
  return Boolean(shift)
}

function directionPhrase(noun: string, direction: TrendResult["direction"]): string {
  if (direction === "rising") return `${noun} are rising`
  if (direction === "falling") return `${noun} are falling`
  return `${noun} are flat`
}

export function overcommitmentSentence(report: {
  warning: boolean
  minutesTrend: TrendResult
  pushTrend: TrendResult
  minutesShift: ChangePoint | null
  pushShift: ChangePoint | null
}): string {
  const minutes = directionPhrase("logged minutes", report.minutesTrend.direction)
  const pushes = directionPhrase("day-pushes", report.pushTrend.direction)
  const shifts: string[] = []
  if (report.minutesShift) {
    shifts.push(`logged minutes shifted up on ${report.minutesShift.date}`)
  }
  if (report.pushShift) {
    shifts.push(`day-pushes shifted up on ${report.pushShift.date}`)
  }

  if (report.warning) {
    const body = [pushes, minutes].join(" and ")
    if (shifts.length) return `${body}, and ${shifts.join(" and ")} — an overcommitment early warning.`
    return `${body} — an overcommitment early warning.`
  }
  return `No overcommitment signal: ${pushes} and ${minutes}.`
}

export function summarizeOvercommitment(
  tasks: OvercommitmentTask[],
  dateKeys: readonly string[],
  options: { floor?: number; today?: Date } = {},
): OvercommitmentReport {
  const floor = options.floor ?? OVERCOMMITMENT_SAMPLE_FLOOR
  const today = options.today ?? new Date()
  const minutes = dailyLoggedMinutes(tasks, dateKeys)
  const pushes = dailyPushCounts(tasks, dateKeys, today)
  const n = observedN(minutes, pushes)

  const minutesTrend = trend(minutes, MINUTES_SLOPE_EPS)
  const pushTrend = trend(pushes, PUSH_SLOPE_EPS)
  const minutesChangePoints = detectChangePoints(minutes)
  const pushChangePoints = detectChangePoints(pushes)
  const minutesRolling = rollingSlope(minutes, ROLLING_WINDOW)
  const pushRolling = rollingSlope(pushes, ROLLING_WINDOW)
  const minutesShift = latestUpward(minutesChangePoints)
  const pushShift = latestUpward(pushChangePoints)

  const keySet = new Set(dateKeys)
  const pushedTaskIds: string[] = []
  const loggedTaskIds: string[] = []
  const seenPush = new Set<string>()
  const seenLog = new Set<string>()
  for (const task of tasks) {
    for (const key of reconstructPushDates(task, today)) {
      if (keySet.has(key) && !seenPush.has(task.id)) {
        seenPush.add(task.id)
        pushedTaskIds.push(task.id)
      }
    }
    for (const log of task.timeLogs ?? []) {
      if (keySet.has(log.date) && (log.durationMinutes ?? 0) > 0 && !seenLog.has(task.id)) {
        seenLog.add(task.id)
        loggedTaskIds.push(task.id)
      }
    }
  }

  let status: OvercommitmentStatus = "ok"
  if (n === 0) status = "empty"
  else if (n < floor) status = "thin"

  const warning =
    status === "ok" &&
    (isRising(pushTrend, lastSlope(pushRolling), pushShift, PUSH_SLOPE_EPS) ||
      isRising(minutesTrend, lastSlope(minutesRolling), minutesShift, MINUTES_SLOPE_EPS))

  return {
    status,
    warning,
    n,
    floor,
    sentence: overcommitmentSentence({
      warning,
      minutesTrend,
      pushTrend,
      minutesShift: warning ? minutesShift : null,
      pushShift: warning ? pushShift : null,
    }),
    minutes,
    pushes,
    minutesTrend,
    pushTrend,
    minutesChangePoints,
    pushChangePoints,
    minutesRolling,
    pushRolling,
    minutesShift,
    pushShift,
    pushedTaskIds,
    loggedTaskIds,
  }
}
