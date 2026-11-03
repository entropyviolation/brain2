/**
 * lib/habit-pause.ts — Paused habits
 *
 * A pause is a span of local days on `WeeklyTask.pauses`. `to` is inclusive.
 * A span with no `to` runs until the person unpauses. Nothing runs on a
 * timer: a span whose `to` is in the past is simply over, so an "until" pause
 * ends on its own at midnight after its last day.
 *
 * Every day, week, month, and season that overlaps a span is exempt
 * (`lib/habit-exemption.ts`). Stored cells keep their values.
 * While a habit is paused today, the lists hide it unless Show paused habits is on.
 */
import type { WeeklyTask } from "./types"
import { addCalendarDays, formatLocalDateKey, parseLocalDate } from "./date-utils"

export type HabitPauseSpan = { from: string; to?: string }

type PauseTask = Pick<WeeklyTask, "pauses">

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

/** Well-formed spans only. A `pauses: null` from a phone patch reads as none. */
export function pauseSpans(habit: PauseTask): HabitPauseSpan[] {
  const raw = habit.pauses
  if (!Array.isArray(raw)) return []
  const out: HabitPauseSpan[] = []
  for (const span of raw) {
    if (!span || typeof span.from !== "string" || !DAY_KEY.test(span.from)) continue
    if (span.to != null && (typeof span.to !== "string" || !DAY_KEY.test(span.to))) continue
    if (span.to && span.to < span.from) continue
    out.push(span.to ? { from: span.from, to: span.to } : { from: span.from })
  }
  return out
}

export function isPausedOn(habit: PauseTask, dayKey: string): boolean {
  return pauseSpans(habit).some((span) => span.from <= dayKey && (!span.to || dayKey <= span.to))
}

export function isPausedNow(habit: PauseTask, todayKey: string): boolean {
  return isPausedOn(habit, todayKey)
}

/** Any paused day falls inside `startKey`..`endKey` (both inclusive). */
export function pausedOverlaps(habit: PauseTask, startKey: string, endKey: string): boolean {
  return pauseSpans(habit).some((span) => span.from <= endKey && (!span.to || span.to >= startKey))
}

/** Habits the list should show for a view: hides habits paused now unless showPaused. */
export function visibleHabits<T extends WeeklyTask>(tasks: T[], todayKey: string, showPaused: boolean): T[] {
  if (showPaused) return tasks
  const shown = tasks.filter((task) => !isPausedNow(task, todayKey))
  return shown.length === tasks.length ? tasks : shown
}

/** The span covering today, if any. Its `to` is the last paused day. */
export function currentPause(habit: PauseTask, todayKey: string): HabitPauseSpan | null {
  const spans = pauseSpans(habit)
  for (let i = spans.length - 1; i >= 0; i--) {
    const span = spans[i]
    if (span.from <= todayKey && (!span.to || todayKey <= span.to)) return span
  }
  return null
}

/** Start a pause today. `until` is the last paused day; omit it to pause indefinitely. */
export function withPause<T extends PauseTask>(habit: T, todayKey: string, until?: string): T {
  const spans = pauseSpans(habit)
  const to = until && DAY_KEY.test(until) && until >= todayKey ? until : undefined
  return { ...habit, pauses: [...spans, to ? { from: todayKey, to } : { from: todayKey }] }
}

/**
 * Close the span covering today at yesterday. Earlier spans stay.
 * A span that started today is dropped: `to = today` would keep the habit
 * paused (and hidden) for the rest of today.
 */
export function withUnpause<T extends PauseTask>(habit: T, todayKey: string): T {
  const spans = pauseSpans(habit)
  const index = spans.findLastIndex((span) => span.from <= todayKey && (!span.to || todayKey <= span.to))
  if (index < 0) return habit
  const live = spans[index]
  const next = spans.slice()
  if (live.from >= todayKey) {
    next.splice(index, 1)
  } else {
    next[index] = { from: live.from, to: shiftDayKey(todayKey, -1) }
  }
  return { ...habit, pauses: next.length ? next : undefined }
}

/** "Paused" or "Paused until Mar 3". */
export function pauseLabel(habit: PauseTask, todayKey: string): string | null {
  const live = currentPause(habit, todayKey)
  if (!live) return null
  if (!live.to) return "Paused"
  const date = parseLocalDate(live.to)
  if (!date) return "Paused"
  return `Paused until ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
}

function shiftDayKey(key: string, days: number): string {
  const date = parseLocalDate(key)
  return date ? formatLocalDateKey(addCalendarDays(date, days)) : key
}
