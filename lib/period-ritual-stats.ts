/**
 * lib/period-ritual-stats.ts — Numbers for a week, month, season, or year ritual
 *
 * Reuses the habit grade, habit-day points, and tracking summaries the rest of
 * the app already trusts. The ritual dialog passes `resolveCompletionPoints`
 * so a missed task is priced by the real completion model. Stats are not
 * reflection questions and do not earn section points.
 */
import type { Folder, List, Task, WeeklyData, WeeklyTask } from "@/lib/types"
import type { ReviewPeriod } from "@/lib/types"
import { calculateWeekToDateGrade } from "@/lib/calculations"
import { getWeekDates, getWeekString, parseLocalDate, parseWeekString } from "@/lib/date-utils"
import { isDailyHabit, dailyHabitCompletionRatio, dailyHabitDayPoints } from "@/lib/habit-points"
import { itemTitle } from "@/lib/item-utils"
import { unfinishedTasksForRitual } from "@/lib/ritual-unfinished"
import { dateFromPeriodKey, getPeriodKey, periodLabel } from "@/lib/reviews-store"
import type { TimeEntry } from "@/lib/time-entries"
import { penTotals, totalsFor } from "@/lib/tracking-summary"
import type { TrackScope } from "@/lib/time-tracking-store"
import { TaskType, type TaskCompletion } from "@/lib/types"

export interface RitualPointRow {
  date: string
  points: number
  taskId: string
  taskDescription: string
}

export interface RitualStatsInput {
  period: Exclude<ReviewPeriod, "day">
  periodKey: string
  now: Date
  tasks: Task[]
  lists: List[]
  folders: Folder[]
  habits: WeeklyTask[]
  weeklyData: WeeklyData
  points: RitualPointRow[]
  entries: TimeEntry[]
  scopes: TrackScope[]
  tolerance?: number
  /** Defaults to `rewardValue`, else 1. The dialog passes `resolveCompletionPoints`. */
  pointsForTask?: (task: Task) => number
}

export interface MissedPoint {
  id: string
  title: string
  points: number
  kind: "task" | "habit"
}

export interface GradeLine {
  label: string
  grade: number
}

export interface TrackingRow {
  name: string
  color: string
  minutes: number
  share: number
  previousMinutes: number
}

export interface RitualStats {
  missed: MissedPoint[]
  points: { current: number; previous: number; delta: number }
  habitGrade: {
    label: string
    current: number
    previous: number
    delta: number
    parts: GradeLine[]
    /** What the nested lines are. Empty when there are none. */
    partsLabel: string
  }
  habitsNever: { id: string; name: string }[]
  tracking: { scopeId: string; scopeName: string; rows: TrackingRow[] }[]
}

function previousKey(period: Exclude<ReviewPeriod, "day">, key: string): string {
  const ref = dateFromPeriodKey(period, key)
  const prev = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  if (period === "week") prev.setDate(prev.getDate() - 7)
  else if (period === "month") prev.setMonth(prev.getMonth() - 1)
  else if (period === "quarter") prev.setMonth(prev.getMonth() - 3)
  else prev.setFullYear(prev.getFullYear() - 1)
  return getPeriodKey(period, prev)
}

function periodBounds(period: Exclude<ReviewPeriod, "day">, key: string): { start: Date; end: Date } {
  const start = dateFromPeriodKey(period, key)
  if (period === "week") {
    const range = parseWeekString(key)
    return { start: range?.start ?? start, end: range?.end ?? start }
  }
  if (period === "month") return { start, end: new Date(start.getFullYear(), start.getMonth() + 1, 0) }
  if (period === "quarter") return { start, end: new Date(start.getFullYear(), start.getMonth() + 3, 0) }
  return { start, end: new Date(start.getFullYear(), 11, 31) }
}

export function dateKeysForPeriod(period: Exclude<ReviewPeriod, "day">, key: string, now: Date): string[] {
  const { start, end } = periodBounds(period, key)
  const cap = now < end ? now : end
  const keys: string[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const last = new Date(cap.getFullYear(), cap.getMonth(), cap.getDate())
  while (cursor <= last) {
    keys.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`,
    )
    cursor.setDate(cursor.getDate() + 1)
  }
  return keys
}

function sumPoints(rows: RitualPointRow[], keys: Set<string>): number {
  return rows.reduce((total, row) => total + (keys.has(row.date) ? row.points : 0), 0)
}

function fullCompletion(habit: WeeklyTask): TaskCompletion {
  if (habit.type === TaskType.TEXT) return { completed: true, text: "done" }
  if (habit.type === TaskType.BOOLEAN) return { completed: true }
  return { completed: true, value: habit.goal && habit.goal > 0 ? habit.goal : 1 }
}

function habitMissedPoints(habit: WeeklyTask, keys: string[], data: WeeklyData): number {
  let missed = 0
  for (const key of keys) {
    const date = parseLocalDate(key)
    if (!date) continue
    const completion = data[key]?.[habit.id]
    const earned = dailyHabitDayPoints(habit, completion, data, date)
    const full = dailyHabitDayPoints(habit, fullCompletion(habit), data, date)
    missed += Math.max(0, full - earned)
  }
  return missed
}

function gradeOver(habits: WeeklyTask[], data: WeeklyData, keys: string[], now: Date, tolerance: number): number {
  const dates = keys.map((key) => parseLocalDate(key)).filter((date): date is Date => !!date)
  if (!dates.length) return 0
  const asOf = dates[dates.length - 1] < now ? dates[dates.length - 1] : now
  return calculateWeekToDateGrade(habits as never, data, dates, asOf, tolerance).grade
}

function gradeLabel(period: Exclude<ReviewPeriod, "day">): string {
  if (period === "week") return "Week grade"
  if (period === "month") return "Month grade"
  if (period === "quarter") return "Season grade"
  return "Year grade"
}

function partGrades(
  period: Exclude<ReviewPeriod, "day">,
  key: string,
  habits: WeeklyTask[],
  data: WeeklyData,
  now: Date,
  tolerance: number,
): GradeLine[] {
  const { start, end } = periodBounds(period, key)
  if (period === "year") {
    const lines: GradeLine[] = []
    for (let month = 0; month < 12; month++) {
      const ref = new Date(start.getFullYear(), month, 1)
      if (ref > now) break
      const monthKey = getPeriodKey("month", ref)
      const keys = dateKeysForPeriod("month", monthKey, now)
      if (!keys.length) continue
      lines.push({
        label: periodLabel("month", monthKey),
        grade: gradeOver(habits, data, keys, now, tolerance),
      })
    }
    return lines
  }
  if (period === "week") return []
  const lines: GradeLine[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const seen = new Set<string>()
  while (cursor <= end && cursor <= now) {
    const weekKey = getWeekString(cursor)
    if (!seen.has(weekKey)) {
      seen.add(weekKey)
      const weekDates = getWeekDates(parseWeekString(weekKey)?.start ?? cursor)
      const keys = weekDates
        .filter((date) => date <= now)
        .map(
          (date) =>
            `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
        )
      if (keys.length) {
        lines.push({
          label: periodLabel("week", weekKey),
          grade: gradeOver(habits, data, keys, now, tolerance),
        })
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return lines
}

export function buildPeriodRitualStats(input: RitualStatsInput): RitualStats {
  const tolerance = input.tolerance ?? 100
  const daily = input.habits.filter(isDailyHabit)
  const keys = dateKeysForPeriod(input.period, input.periodKey, input.now)
  const keySet = new Set(keys)
  const prevKeys = dateKeysForPeriod(input.period, previousKey(input.period, input.periodKey), input.now)
  const prevSet = new Set(prevKeys)
  const price = input.pointsForTask ?? ((task: Task) => task.rewardValue || 1)

  const missed: MissedPoint[] = []
  for (const task of unfinishedTasksForRitual(input.tasks, input.period, input.periodKey, input.now)) {
    const points = price(task)
    if (points > 0) missed.push({ id: task.id, title: itemTitle(task) || task.description || "Task", points, kind: "task" })
  }
  for (const habit of daily) {
    const points = habitMissedPoints(habit, keys, input.weeklyData)
    if (points > 0) missed.push({ id: habit.id, title: habit.name, points, kind: "habit" })
  }
  missed.sort((a, b) => b.points - a.points)

  const habitsNever = daily
    .filter((habit) =>
      keys.every((key) => {
        const date = parseLocalDate(key)
        if (!date) return true
        return dailyHabitCompletionRatio(habit, input.weeklyData[key]?.[habit.id], input.weeklyData, date) === 0
      }),
    )
    .map((habit) => ({ id: habit.id, name: habit.name }))

  const currentGrade = gradeOver(daily, input.weeklyData, keys, input.now, tolerance)
  const previousGrade = gradeOver(daily, input.weeklyData, prevKeys, input.now, tolerance)

  const tracking = input.scopes
    .map((scope) => {
      const scoped = input.entries.filter((entry) => entry.scopeId === scope.id)
      const rows = penTotals(scoped, scope, keys)
      const prev = penTotals(scoped, scope, prevKeys)
      const prevById = new Map(prev.map((row) => [row.id, row.minutes]))
      const tracked = totalsFor(scoped, keys).tracked
      return {
        scopeId: scope.id,
        scopeName: scope.name,
        rows: rows.slice(0, 8).map((row) => ({
          name: row.name,
          color: row.color,
          minutes: row.minutes,
          share: tracked > 0 ? Math.round((row.minutes / tracked) * 100) : 0,
          previousMinutes: prevById.get(row.id) ?? 0,
        })),
      }
    })
    .filter((scope) => scope.rows.some((row) => row.minutes > 0 || row.previousMinutes > 0))

  return {
    missed: missed.slice(0, 8),
    points: {
      current: sumPoints(input.points, keySet),
      previous: sumPoints(input.points, prevSet),
      delta: sumPoints(input.points, keySet) - sumPoints(input.points, prevSet),
    },
    habitGrade: {
      label: gradeLabel(input.period),
      current: currentGrade,
      previous: previousGrade,
      delta: currentGrade - previousGrade,
      parts: partGrades(input.period, input.periodKey, daily, input.weeklyData, input.now, tolerance),
      partsLabel: input.period === "year" ? "Months" : input.period === "week" ? "" : "Weeks",
    },
    habitsNever,
    tracking,
  }
}
