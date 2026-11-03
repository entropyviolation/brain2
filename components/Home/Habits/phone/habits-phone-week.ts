/**
 * components/Home/Habits/phone/habits-phone-week.ts — Phone week grid math
 *
 * Pure helpers for the phone shell: the row label, square brightness, the
 * paused filter, the chevron lens, and the cell history in plain words.
 * The desktop grids do not read this file.
 */
import { periodCellPercentage } from "@/lib/calculations"
import { habitCellRatio } from "@/lib/habit-priority"
import { normalizeTaskType } from "@/lib/habit-utils"
import {
  TaskType,
  type HabitCellChange,
  type HabitCellChangeSource,
  type HabitFrequency,
  type TaskCompletion,
  type WeeklyData,
  type WeeklyTask,
} from "@/lib/types"

/** Row label for the period grid. Contract rule: shorthand, else the name. */
export function phoneHabitLabel(task: Pick<WeeklyTask, "name" | "shorthandName">): string {
  return task.shorthandName?.trim() || task.name
}

/** Yes/No habits are lamps on the phone. */
export function isLampHabit(task: Pick<WeeklyTask, "type">): boolean {
  return normalizeTaskType(task.type) === TaskType.BOOLEAN
}

/**
 * Square brightness, 0 to 1. Met is 1, not done is 0, and a partial is its
 * share: goal 5 with 2 marked is 0.4. Daily squares use the day ratio the
 * points use; span squares use the column share the span grade uses.
 */
export function phoneCellBrightness(
  task: WeeklyTask,
  completion: TaskCompletion | undefined,
  data: WeeklyData,
  date: Date,
  daily: boolean,
): number {
  if (daily) return clamp01(habitCellRatio(task, completion, data, date))
  const pct = periodCellPercentage(task, completion, { key: "", date }, data)
  return pct == null ? 0 : clamp01(pct / 100)
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

/**
 * Paused on `dayKey` (YYYY-MM-DD, `to` inclusive). Mirrors `isPausedOn` in
 * the contract's `lib/habit-pause.ts`, which session A owns. Swap to that
 * import once it lands.
 */
export function phonePausedOn(task: Pick<WeeklyTask, "pauses">, dayKey: string): boolean {
  return (task.pauses ?? []).some((span) => span.from <= dayKey && (!span.to || dayKey <= span.to))
}

/** Hides habits paused today unless Show paused habits is on. Mirrors the contract's `visibleHabits`. */
export function phoneVisibleHabits<T extends Pick<WeeklyTask, "pauses">>(
  tasks: T[],
  todayKey: string,
  showPaused: boolean,
): T[] {
  if (showPaused) return tasks
  return tasks.filter((task) => !phonePausedOn(task, todayKey))
}

/** A paused span square covers any day of the span. */
export function phonePausedOverlaps(task: Pick<WeeklyTask, "pauses">, startKey: string, endKey: string): boolean {
  return (task.pauses ?? []).some((span) => span.from <= endKey && (!span.to || startKey <= span.to))
}

export type PhoneNavLens = "day" | "week" | "month" | "season"

/**
 * What the header chevrons move. The Daily list is one day, so they step a
 * day, the same lens as the drag. The Week sheet and the heatmap step a week.
 */
export function phoneNavLens(frequency: HabitFrequency, weekSheet: boolean, heatmap: boolean): PhoneNavLens {
  if (frequency === "weekly") return "week"
  if (frequency === "monthly") return "month"
  if (frequency === "quarterly") return "season"
  return weekSheet || heatmap ? "week" : "day"
}

const SOURCE_LABEL: Record<HabitCellChangeSource, string> = {
  "manual-desktop": "Manual · desktop",
  "manual-ios": "Manual · iPhone",
  "llm-suggestion": "Suggested by helper",
  "auto-tracking": "From Tracking",
  "auto-link": "From link",
  wand: "Wand",
}

export function cellChangeSourceLabel(source: HabitCellChangeSource | string): string {
  return SOURCE_LABEL[source as HabitCellChangeSource] ?? source
}

/** The cell's change log, newest first. The stored log is newest last. */
export function phoneCellHistory(completion: TaskCompletion | undefined): HabitCellChange[] {
  return [...(completion?.changes ?? [])].reverse()
}

export function formatCellChangeValue(value: HabitCellChange["to"] | undefined): string {
  if (value === undefined || value === null || value === "") return "—"
  if (value === true) return "done"
  if (value === false) return "not done"
  return String(value)
}

