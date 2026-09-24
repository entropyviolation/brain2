/**
 * lib/habit-tracking.ts — Habit ⇄ Tracking tag link math
 *
 * A daily, weekly, or monthly Goal / Yes-No habit may carry a `trackingLink`
 * (`lib/types.ts`): tracked minutes on pens tagged e.g. "Cleaning" flow into the
 * habit's value for that day, week, or month.
 *
 * The completion record keeps the two contributions apart — `manualValue` is
 * what the user typed, `trackedValue` is what the grid produced — so re-running
 * the sync after every paint is idempotent and never double-counts. `value`
 * stays the combined number the rest of the app already reads (grade math,
 * points, week %), so nothing downstream needs to know a link exists.
 *
 * Pure: no store imports, so `lib/habits-store.ts` can use it without a cycle.
 * The store bridge lives in `lib/habit-tracking-sync.ts`.
 */
import {
  TaskType,
  type HabitTrackingLink,
  type HabitTrackingUnit,
  type TaskCompletion,
  type WeeklyTask,
} from "@/lib/types"
import { isGoalType } from "@/lib/habit-utils"

export const DEFAULT_TRACKING_LINK: Required<Pick<HabitTrackingLink, "tagIds" | "unit" | "mode">> = {
  tagIds: [],
  unit: "minutes",
  mode: "add",
}

/** Habit types that can be auto-filled. TEXT and climb habits are excluded. */
export function supportsTrackingLink(task: Pick<WeeklyTask, "type" | "frequency">): boolean {
  return isGoalType(task.type) || task.type === TaskType.BOOLEAN
}

/** The link if it is usable — enabled, on a supported habit, with at least one tag. */
export function activeTrackingLink(task: WeeklyTask): HabitTrackingLink | undefined {
  const link = task.trackingLink
  if (!link || link.enabled === false) return undefined
  if (!link.tagIds?.length) return undefined
  if (!supportsTrackingLink(task)) return undefined
  return link
}

export function trackingUnitLabel(unit: HabitTrackingUnit | undefined): string {
  return unit === "hours" ? "hours" : "minutes"
}

/** Minutes → the link's unit, rounded so habit cells stay readable. */
export function convertTrackedMinutes(minutes: number, unit: HabitTrackingUnit | undefined): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0
  if (unit === "hours") return Math.round((minutes / 60) * 100) / 100
  return minutes
}

/**
 * The manual half of an existing completion. Completions written before the
 * link existed only have `value`, so treat that whole number as manual — linking
 * a habit never silently erases what was already logged.
 */
export function manualBaseOf(completion: TaskCompletion | undefined): number {
  if (!completion) return 0
  if (completion.manualValue !== undefined) return completion.manualValue
  return completion.value ?? 0
}

export function combineTrackedValue(link: HabitTrackingLink, manual: number, tracked: number): number {
  const mode = link.mode ?? DEFAULT_TRACKING_LINK.mode
  if (mode === "replace") return tracked
  if (mode === "max") return Math.max(manual, tracked)
  return manual + tracked
}

/** BOOLEAN habits auto-check once tracked time clears the threshold (default: any). */
export function meetsTrackingThreshold(link: HabitTrackingLink, tracked: number): boolean {
  const threshold = link.threshold
  if (threshold === undefined || threshold <= 0) return tracked > 0
  return tracked >= threshold
}

/**
 * The completion a day should hold given `tracked` (already converted).
 * Returns `null` when nothing would change, so the sync can skip the write and
 * avoid re-running points/Done-log side effects on every repaint.
 */
export function applyTrackedToCompletion(
  task: WeeklyTask,
  link: HabitTrackingLink,
  completion: TaskCompletion | undefined,
  tracked: number,
): TaskCompletion | null {
  // Never open an empty record for a day the tracker has nothing to say about:
  // habits with no data are excluded from the day's completion average, so a
  // stray 0 (or unchecked box) would quietly count against the day.
  if (task.type === TaskType.BOOLEAN) {
    const met = meetsTrackingThreshold(link, tracked)
    if (!met && !completion) return null
    // Only the tracker's own check is withdrawn; a hand-ticked day stays ticked.
    const manuallyChecked = completion?.completed === true && !completion.trackedCompleted
    const completed = met || manuallyChecked
    if (completion?.completed === completed && (completion?.trackedCompleted ?? false) === met) return null
    return { ...completion, completed, trackedCompleted: met }
  }

  if (tracked === 0 && !completion) return null

  const manual = manualBaseOf(completion)
  const value = combineTrackedValue(link, manual, tracked)
  const unchanged =
    completion?.value === value && (completion?.trackedValue ?? 0) === tracked && manualBaseOf(completion) === manual
  if (unchanged && (tracked === 0 || completion?.trackedValue !== undefined)) return null
  return { ...completion, manualValue: manual, trackedValue: tracked, value, goal: task.goal ?? completion?.goal }
}

/**
 * Undo the tracker's contribution after a habit loses its link, so the day falls
 * back to what the user logged by hand instead of stranding tracked minutes in
 * `value`. Returns `null` when the completion holds nothing tracked.
 */
export function clearTrackedFromCompletion(
  task: WeeklyTask,
  completion: TaskCompletion | undefined,
): TaskCompletion | null {
  if (!completion) return null
  if (completion.trackedValue === undefined && completion.trackedCompleted === undefined) return null
  const { trackedValue, manualValue, trackedCompleted, ...rest } = completion
  if (task.type === TaskType.BOOLEAN) {
    return { ...rest, completed: trackedCompleted ? false : completion.completed }
  }
  return { ...rest, value: manualValue ?? completion.value ?? 0 }
}

/**
 * Re-derive `manualValue` when the user types a total into a linked habit cell.
 * The number they entered is the total they want to see, so the manual half is
 * whatever is left after the tracked contribution.
 */
export function reconcileManualEntry(
  task: WeeklyTask,
  previous: TaskCompletion | undefined,
  next: TaskCompletion,
): TaskCompletion {
  const link = activeTrackingLink(task)
  if (!link) return next

  if (task.type === TaskType.BOOLEAN) {
    if (!next.completed) {
      const cleared = { ...next, trackedCompleted: false }
      delete cleared.sleepCompleted
      delete cleared.listCompleted
      return cleared
    }
    return {
      ...next,
      trackedCompleted: previous?.trackedCompleted ?? false,
      ...(previous?.sleepCompleted ? { sleepCompleted: true } : {}),
      ...(previous?.listCompleted ? { listCompleted: true } : {}),
    }
  }

  const tracked = previous?.trackedValue ?? 0
  if (next.value === undefined) return { ...next, trackedValue: tracked }
  const mode = link.mode ?? DEFAULT_TRACKING_LINK.mode
  const manual = mode === "add" ? Math.max(0, next.value - tracked) : next.value
  return { ...next, manualValue: manual, trackedValue: tracked }
}

/** Human summary for the habit form and the grid tooltip. */
export function describeTrackingLink(
  link: HabitTrackingLink,
  tagNames: string[],
  task?: Pick<WeeklyTask, "type">,
): string {
  const tags = tagNames.length ? tagNames.join(", ") : "no tags yet"
  if (task && task.type === TaskType.BOOLEAN) {
    const threshold = link.threshold && link.threshold > 0 ? `${link.threshold} ${trackingUnitLabel(link.unit)}` : "any"
    return `Checks off after ${threshold} tracked on ${tags}`
  }
  const mode = link.mode ?? DEFAULT_TRACKING_LINK.mode
  const verb = mode === "replace" ? "replaces the logged value with" : mode === "max" ? "counts the higher of your log and" : "adds"
  return `${verb} tracked ${trackingUnitLabel(link.unit)} on ${tags}`
}
