/**
 * lib/habit-time-estimate.ts — How long a habit's day actually took
 *
 * A daily habit records an *amount* ("4 pages"), not a length of time. But it
 * always consumed time, and that time is what makes a Done row worth anything to
 * the review, Analytics, or a plan-vs-reality comparison. So each habit may carry
 * a `timeEstimate`: minutes per unit of its goal (10 min per page) and/or a flat
 * length per completion (a 20-minute stretch).
 *
 * Precedence, most trustworthy first:
 *   1. the habit is already measured in time (unit minutes/hours) — the logged
 *      number *is* the duration, so it is observed, not assumed;
 *   2. minutes painted on the habit's Tracking tags that day (observed), plus a
 *      rate-derived top-up for anything logged by hand beyond it;
 *   3. logged amount × minutes-per-unit (assumed);
 *   4. the flat per-completion length (assumed);
 *   5. nothing — the habit has no time component configured.
 *
 * `estimated: false` means nobody has to confirm the number. Anything else is
 * flagged on the Done row via `lib/estimated-values.ts`.
 *
 * Pure: takes tracked minutes as an argument so tests never touch a store.
 */
import { TaskType, type EstimateKind, type TaskCompletion, type WeeklyTask } from "@/lib/types"
import { isGoalType } from "@/lib/habit-utils"
import { manualBaseOf } from "@/lib/habit-tracking"
import { normalizeIncrementalData } from "@/lib/incremental-habits"
import { formatDurationMinutes } from "@/lib/estimated-values"

export interface HabitDuration {
  /** Whole minutes the habit is taken to have consumed that period. */
  minutes: number
  kind: EstimateKind
  /** True when the number is assumed and should be confirmed by the user. */
  estimated: boolean
  /** One-line explanation ("4 pages × 10 min/page"). */
  basis: string
}

const MINUTE_UNITS = new Set(["minute", "minutes", "min", "mins", "m"])
const HOUR_UNITS = new Set(["hour", "hours", "hr", "hrs", "h"])

/** The habit's own scale label — its unit, or a climb habit's metric unit. */
function unitOf(habit: Pick<WeeklyTask, "unit" | "incrementalData">): string {
  return (habit.unit || normalizeIncrementalData(habit.incrementalData)?.unit || "").trim()
}

/** Minutes in one unit of the habit's own scale, or `null` when it isn't time. */
export function habitUnitMinutes(habit: Pick<WeeklyTask, "unit" | "incrementalData">): number | null {
  const raw = unitOf(habit).toLowerCase()
  if (!raw) return null
  if (MINUTE_UNITS.has(raw)) return 1
  if (HOUR_UNITS.has(raw)) return 60
  return null
}

function unitLabel(habit: WeeklyTask, amount: number): string {
  const raw = unitOf(habit)
  if (raw) return raw
  return amount === 1 ? "completion" : "completions"
}

/** What the habit logged for the period, on its own scale. Yes/No and Text count as one. */
export function habitLoggedAmount(habit: WeeklyTask, completion: TaskCompletion | undefined): number {
  if (!completion) return 0
  if (habit.type === TaskType.BOOLEAN) return completion.completed ? 1 : 0
  if (habit.type === TaskType.TEXT) return completion.text?.trim() ? 1 : 0
  return completion.value ?? 0
}

function rateOf(habit: WeeklyTask): number {
  const rate = habit.timeEstimate?.minutesPerUnit
  return Number.isFinite(rate) && (rate as number) > 0 ? (rate as number) : 0
}

function flatOf(habit: WeeklyTask): number {
  const flat = habit.timeEstimate?.minutes
  return Number.isFinite(flat) && (flat as number) > 0 ? (flat as number) : 0
}

/** A `definite` length is known, so it never asks the user to confirm it. */
function definite(habit: WeeklyTask): boolean {
  return habit.timeEstimate?.precision === "definite"
}

function round(minutes: number): number {
  return Math.max(0, Math.round(minutes))
}

/** True for habits whose logged number already is a length of time. */
export function isTimeMeasuredHabit(habit: WeeklyTask): boolean {
  if (habit.type === TaskType.BOOLEAN || habit.type === TaskType.TEXT) return false
  return habitUnitMinutes(habit) !== null
}

/**
 * The duration to record for `habit` on a period it met its goal, or `null` when
 * the habit has no time component to derive one from.
 *
 * `trackedMinutes` is minutes painted on the habit's Tracking tags for that day
 * (see `lib/tracked-time.ts`); pass 0 when there is no link or no paint.
 */
export function habitDurationEstimate(
  habit: WeeklyTask,
  completion: TaskCompletion | undefined,
  trackedMinutes = 0,
): HabitDuration | null {
  const amount = habitLoggedAmount(habit, completion)
  const unitMinutes = habitUnitMinutes(habit)
  const rate = rateOf(habit)
  const flat = flatOf(habit)
  const paint = round(trackedMinutes)

  // 1. The habit is measured in time already: its own number is the duration.
  if (isTimeMeasuredHabit(habit) && unitMinutes && amount > 0) {
    const minutes = round(amount * unitMinutes)
    const fromPaint = paint > 0
    return {
      minutes,
      kind: fromPaint ? "tracked" : "logged",
      estimated: false,
      basis: fromPaint
        ? `${formatDurationMinutes(minutes)} logged, ${formatDurationMinutes(paint)} of it painted in Tracking`
        : `${formatDurationMinutes(minutes)} logged on the habit`,
    }
  }

  // 2. Painted time is observed; only a hand-logged remainder needs a rate.
  if (paint > 0) {
    const manual = habit.type === TaskType.BOOLEAN ? 0 : manualBaseOf(completion)
    const addsManual = (habit.trackingLink?.mode ?? "add") === "add" && rate > 0 && manual > 0
    const extra = addsManual ? round(manual * rate) : 0
    return {
      minutes: paint + extra,
      kind: extra > 0 ? "rate" : "tracked",
      estimated: extra > 0 && !definite(habit),
      basis:
        extra > 0
          ? `${formatDurationMinutes(paint)} painted in Tracking + ${manual} ${unitLabel(habit, manual)} × ${rate} min each`
          : `${formatDurationMinutes(paint)} painted in Tracking`,
    }
  }

  // 3. Logged amount × the configured rate.
  if (rate > 0 && amount > 0 && (isGoalType(habit.type) || habit.type === TaskType.INCREMENTAL)) {
    return {
      minutes: round(amount * rate),
      kind: "rate",
      estimated: !definite(habit),
      basis: `${amount} ${unitLabel(habit, amount)} × ${rate} min each`,
    }
  }

  // 4. A flat length per completion (Yes/No habits, or a goal without a rate).
  const perCompletion = flat > 0 ? flat : amount > 0 && rate > 0 ? rate : 0
  if (perCompletion > 0 && amount > 0) {
    return {
      minutes: round(perCompletion),
      kind: "flat",
      estimated: !definite(habit),
      basis: `${formatDurationMinutes(round(perCompletion))} assumed per completion`,
    }
  }

  return null
}

/** Form/grid summary of what a habit's time estimate will produce. */
export function describeHabitTimeEstimate(habit: WeeklyTask): string {
  const rate = rateOf(habit)
  const flat = flatOf(habit)
  if (isTimeMeasuredHabit(habit)) return "Measured in time already — the logged value is the duration."
  const suffix = definite(habit)
    ? " Recorded as a known length (no confirmation asked)."
    : " Recorded as an assumption, flagged for confirmation in your review."
  if (rate > 0) {
    const goal = habit.goal ?? 0
    const example = goal > 0 ? ` A goal day (${goal}) works out to ${formatDurationMinutes(goal * rate)}.` : ""
    return `${rate} min per ${unitLabel(habit, 1)}.${example}${suffix}`
  }
  if (flat > 0) return `${formatDurationMinutes(flat)} per completion.${suffix}`
  return "No time component — Done rows for this habit carry a finish time but no duration."
}
