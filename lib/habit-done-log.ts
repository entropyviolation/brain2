/**
 * lib/habit-done-log.ts — Mirror habit completions into To-Do Done
 *
 * When a habit first meets its goal for a day (or weekly/monthly period), write
 * a `loggedAction` row into the task store so it appears in Done today / this
 * week / this month and in Analytics task counts. Un-meeting the goal removes
 * that row. Points stay on `habits-store` (rewardValue 0 here; no completion popup).
 *
 * The row is not a bare date. It carries **how long the habit took** and **where
 * in the day it sat**, derived from the best evidence available:
 * `lib/habit-time-estimate.ts` for the duration (painted Tracking minutes, the
 * habit's own minutes/hours value, or its per-unit rate) and
 * `lib/completion-window.ts` for the clock window (painted minutes, "just now", or
 * the user's day anchor). Everything assumed rather than observed is flagged with
 * a `FieldEstimate` (`lib/estimated-values.ts`) so the Done list marks it and the
 * review can ask the user to confirm or correct it.
 *
 * The estimate is also **refreshed** while the goal stays met: logging a 4th page
 * on a 3-page habit lifts the recorded duration, unless the user already
 * confirmed that value, in which case their number stands.
 *
 * Optional Done-task wording (`doneTaskPhrase`, `doneTaskUseText`) is applied
 * when the row is created, and again only when the row still shows the line this
 * helper would have written for the previous log. Older rows that still use the
 * habit name are left alone.
 */
import { TaskType, type FieldEstimate, type Task, type TaskCompletion, type WeeklyData, type WeeklyTask } from "@/lib/types"
import { LOGGED_ACTION_TYPE_ID } from "@/lib/item-types"
import { taskRepository } from "@/lib/data/task-repository"
import { formatLocalDateKey } from "@/lib/date-utils"
import { isHabitGoalMet } from "@/lib/habit-utils"
import { activeTrackingLink } from "@/lib/habit-tracking"
import { habitDurationEstimate, habitLoggedAmount, type HabitDuration } from "@/lib/habit-time-estimate"
import { completionWindow, type CompletionWindow } from "@/lib/completion-window"
import { trackedMinuteSetForTags } from "@/lib/tracked-time"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import { awakeWindowFor } from "@/lib/sleep-sync"
import { canRegenerate, makeEstimate, mergeEstimates } from "@/lib/estimated-values"

export function habitDoneLogId(habitId: string, date: Date): string {
  return `habit-done-${habitId}-${formatLocalDateKey(date)}`
}

const VALUE_TOKEN = "{value}"

function loggedPhraseNumber(habit: WeeklyTask, completion: TaskCompletion | undefined): string {
  if (completion && typeof completion.value === "number" && Number.isFinite(completion.value)) {
    return String(completion.value)
  }
  return String(habitLoggedAmount(habit, completion))
}

/**
 * The Done-list line for a habit that is being logged now.
 * No custom wording → the habit name, exactly as before.
 * `{value}` is the number logged (7 pages stays 7 even when the goal is 3).
 * A phrase with no token is used as written. A text habit can use the cell text.
 */
export function habitDoneLogLine(habit: WeeklyTask, completion: TaskCompletion | undefined): string {
  if (habit.type === TaskType.TEXT && habit.doneTaskUseText) {
    const text = completion?.text?.trim()
    if (text) return text
  }
  const phrase = habit.doneTaskPhrase?.trim() ?? ""
  if (!phrase) return habit.name
  if (!phrase.includes(VALUE_TOKEN)) return phrase
  return phrase.split(VALUE_TOKEN).join(loggedPhraseNumber(habit, completion))
}

/**
 * Move the Done line only when it still matches the wording the previous log
 * would have produced. A row written before any phrase, or a title someone
 * edited by hand, stays put.
 */
function wordingPatch(
  existing: Task,
  habit: WeeklyTask,
  previous: TaskCompletion | undefined,
  completion: TaskCompletion,
): Partial<Task> | null {
  const line = habitDoneLogLine(habit, completion)
  const previousLine = habitDoneLogLine(habit, previous)
  if (existing.description !== previousLine || line === existing.description) return null
  const patch: Partial<Task> = { description: line }
  if (existing.title === previousLine || existing.title === existing.description) patch.title = line
  return patch
}

/** Minutes painted on this habit's linked tags for `date`, if it has a live link. */
function paintedMinutes(habit: WeeklyTask, date: Date): Set<number> | undefined {
  const link = activeTrackingLink(habit)
  if (!link) return undefined
  const { scopes, entries } = useTimeTrackingStore.getState()
  const minutes = trackedMinuteSetForTags({ scopes, entries }, formatLocalDateKey(date), link.tagIds)
  return minutes.size > 0 ? minutes : undefined
}

interface DerivedCompletion {
  duration: HabitDuration | null
  window: CompletionWindow
  estimates: FieldEstimate[]
}

/**
 * Duration + clock window + provenance for a habit day. The store path goes
 * through `syncHabitDoneLog`.
 */
function deriveHabitCompletion(
  habit: WeeklyTask,
  date: Date,
  completion: TaskCompletion,
  now = new Date(),
): DerivedCompletion {
  const minutes = paintedMinutes(habit, date)
  const trackedMinutes = minutes?.size ?? 0
  const duration = habitDurationEstimate(habit, completion, trackedMinutes)
  const window = completionWindow({
    date,
    durationMinutes: duration?.minutes ?? 0,
    trackedMinutes: minutes,
    now,
    anchorMinutes: useUserSettingsStore.getState().dayAnchorMinutes,
    awake: awakeWindowFor(formatLocalDateKey(date)),
  })

  const estimates: FieldEstimate[] = window.estimatedFields.map((field) =>
    makeEstimate(field, window.kind, window.basis, now),
  )
  if (duration && duration.estimated) {
    estimates.push(makeEstimate("actualDuration", duration.kind, duration.basis, now))
  }
  return { duration, window, estimates }
}

/**
 * Bring an existing row's derived time up to date after the logged amount changed.
 * The finish time stays put unless painted Tracking time now gives a real one —
 * chasing "now" on every keystroke would rewrite history as the user types. The
 * start slides with the duration. Confirmed fields are never touched.
 */
function refreshPatch(existing: Task, derived: DerivedCompletion, now: Date): Partial<Task> | null {
  const minutes = derived.duration?.minutes
  const durationOpen = canRegenerate(existing.estimates, "actualDuration")
  const fromPaint = derived.window.kind === "tracked" && canRegenerate(existing.estimates, "completedDate")
  const durationChanged = durationOpen && minutes !== undefined && minutes !== existing.actualDuration
  const finishChanged = fromPaint && derived.window.completedAt.getTime() !== existing.completedDate?.getTime()
  if (!durationChanged && !finishChanged) return null

  const patch: Partial<Task> = {}
  const written: FieldEstimate[] = []

  if (finishChanged) {
    patch.completedDate = derived.window.completedAt
    const estimate = derived.estimates.find((e) => e.field === "completedDate")
    if (estimate) written.push(estimate)
  }
  if (durationChanged) {
    patch.actualDuration = minutes
    patch.estimatedDuration = minutes
    const estimate = derived.estimates.find((e) => e.field === "actualDuration")
    if (estimate) written.push(estimate)
  }

  const finish = patch.completedDate ?? existing.completedDate
  if (finish && minutes !== undefined && canRegenerate(existing.estimates, "startedAt")) {
    patch.startedAt = new Date(finish.getTime() - minutes * 60_000)
    written.push(
      derived.estimates.find((e) => e.field === "startedAt") ??
        makeEstimate("startedAt", derived.window.kind, derived.window.basis, now),
    )
  }

  patch.estimates = mergeEstimates(existing.estimates, written)
  return patch
}

export function syncHabitDoneLog(
  habit: WeeklyTask,
  date: Date,
  previous: TaskCompletion | undefined,
  completion: TaskCompletion,
  weeklyData: WeeklyData,
  now = new Date(),
): void {
  const ctx = { date, weeklyData }
  const wasMet = previous ? isHabitGoalMet(habit, previous, ctx) : false
  const nowMet = isHabitGoalMet(habit, completion, ctx)
  const id = habitDoneLogId(habit.id, date)
  const existing = taskRepository.getById(id)

  // Still met: the amount logged may have grown (3 pages required, 4 written), so
  // refresh the derived time — leaving anything the user already confirmed alone.
  if (nowMet && wasMet) {
    if (!existing) return
    const patch = refreshPatch(existing, deriveHabitCompletion(habit, date, completion, now), now)
    const words = wordingPatch(existing, habit, previous, completion)
    if (patch || words) taskRepository.update({ ...existing, ...patch, ...words })
    return
  }

  if (nowMet === wasMet) return

  if (nowMet && !wasMet) {
    if (existing) return
    const derived = deriveHabitCompletion(habit, date, completion, now)
    const { completedAt, startedAt } = derived.window
    const line = habitDoneLogLine(habit, completion)
    taskRepository.add({
      id,
      description: line,
      title: line,
      type: LOGGED_ACTION_TYPE_ID,
      loggedAction: true,
      stage: "completed",
      status: "done",
      createdAt: completedAt,
      completed: true,
      completedDate: completedAt,
      startedAt,
      scheduledDate: completedAt,
      ...(derived.duration
        ? { actualDuration: derived.duration.minutes, estimatedDuration: derived.duration.minutes }
        : {}),
      ...(derived.estimates.length ? { estimates: derived.estimates } : {}),
      lists: [],
      tags: ["habit"],
      links: [],
      rewardValue: 0,
      attributes: { sourceHabitId: habit.id },
    })
    return
  }

  if (wasMet && !nowMet && existing) {
    taskRepository.remove(id)
  }
}
