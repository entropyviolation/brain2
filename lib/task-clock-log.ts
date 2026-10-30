/**
 * lib/task-clock-log.ts — What a pen clock writes back onto its task
 *
 * When a task is on the Tracking pen clock (`lib/task-clock.ts`), these keep
 * the task in step with the clock:
 * - stopping logs one `timeLogs` entry for the span, with the step and the
 *   painted entry ids, so a total can skip the paint it already counted;
 * - an objective tied to a step ticks (or reopens) that step, with the
 *   objective's active work as its actual minutes (a parked gap does not count;
 *   an unknown start writes no minutes);
 * - a typed objective is matched to an open step by name;
 * - free objectives can be kept as steps.
 *
 * Imported by `lib/pen-color-session.ts`, so it must not import that module.
 */
import type { Subtask, Task, TimeLogEntry } from "@/lib/types"
import { objectiveCompletesTarget, objectiveWorkedMs, type NowObjective } from "@/lib/now-objective"
import { useTaskStore } from "@/lib/task-store"
import { formatLocalDateKey, formatLocalHhmm } from "@/lib/date-utils"
import { finishStep, placeSteps, stepPath } from "@/lib/next-step"
import { addNestedStep, updateNestedStep } from "@/lib/todo-steps"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { recordClockSitting } from "@/lib/item-activity"
import { mergeSittingNote, type WorkPauseSpan } from "@/lib/work-pause"

export interface ClockTaskRef {
  taskId?: string
  stepId?: string
  trackingEntryIds?: string[]
  nowObjectives?: readonly NowObjective[]
  /** Reasons for pausing this sitting. Written onto the time log at Stop. */
  pauseSpans?: readonly WorkPauseSpan[]
}

/** Every block this clock paints starts its note with this. A hand-written note does not. */
export const WORKING_ON_NOW_NOTE_PREFIX = "added from Working On Now"

function listOrNone(items: readonly string[] | undefined): string {
  const names = (items ?? []).map((item) => item.trim()).filter(Boolean)
  return names.length ? names.join(", ") : "none"
}

/**
 * The sentence a Working-on-right-now block carries.
 * `added from Working On Now, task: {name} subtasks completed: {list} objectives completed: {list}`
 */
export function workingOnNowNote(input: {
  taskName?: string
  subtasksCompleted?: readonly string[]
  objectivesCompleted?: readonly string[]
}): string {
  const task = input.taskName?.trim() || "none"
  return `${WORKING_ON_NOW_NOTE_PREFIX}, task: ${task} subtasks completed: ${listOrNone(input.subtasksCompleted)} objectives completed: ${listOrNone(input.objectivesCompleted)}`
}

/** That sentence for the task and the objectives on this sitting. */
export function workingOnNowBlockNote(session: {
  taskId?: string
  stepId?: string
  nowObjectives?: readonly NowObjective[]
}): string {
  const task = getTask(session.taskId)
  const done = (session.nowObjectives ?? []).filter((row) => row.completedAt)
  const steps: string[] = []
  const seen = new Set<string>()
  const push = (name: string | undefined) => {
    const text = name?.trim()
    if (!text || seen.has(text)) return
    seen.add(text)
    steps.push(text)
  }
  if (task) {
    for (const row of done) {
      if (!row.stepId) continue
      const placed = placeSteps(task.subtasks).find((p) => p.step.id === row.stepId)
      push(placed?.step.description ?? row.text)
    }
    if (session.stepId) {
      const current = placeSteps(task.subtasks).find((p) => p.step.id === session.stepId)
      if (current?.step.completed) push(current.step.description)
    }
  }
  return workingOnNowNote({
    taskName: task ? itemTitleOrUntitled(task) : undefined,
    subtasksCompleted: steps,
    objectivesCompleted: done.map((row) => row.text),
  })
}

/**
 * The clock fills an empty note, and refreshes one it already wrote.
 * A note you changed yourself is left alone.
 */
export function clockNoteField(existing: string | undefined, note: string): { notes: string } | undefined {
  if (!existing || existing.startsWith(WORKING_ON_NOW_NOTE_PREFIX)) return { notes: note }
  return undefined
}

function getTask(taskId: string | undefined): Task | undefined {
  if (!taskId) return undefined
  return useTaskStore.getState().tasks.find((t) => t.id === taskId)
}

/** `Finish CDs › insert › find photos`, or the task name alone. */
export function clockPathLabel(task: Task | undefined, stepId?: string): string {
  if (!task) return ""
  const title = itemTitleOrUntitled(task)
  if (!stepId) return title
  const placed = placeSteps(task.subtasks).find((p) => p.step.id === stepId)
  if (!placed) return title
  return [title, ...placed.path.map((s) => s.description), placed.step.description].join(" › ")
}

/**
 * Write one time log for a clock span. Under a minute the time log is skipped,
 * and the sitting is still one History line on the task (active time only).
 */
export function logTaskClockSpan(ref: ClockTaskRef, start: Date, end: Date, activeMs: number): TimeLogEntry | null {
  const task = getTask(ref.taskId)
  if (!task) return null
  const minutes = Math.round(activeMs / 60_000)
  if (minutes < 1) {
    if (activeMs > 0) {
      const placed = ref.stepId ? placeSteps(task.subtasks).find((p) => p.step.id === ref.stepId) : undefined
      recordClockSitting({
        itemId: task.id,
        activeMs,
        sittingAt: start,
        recordedAt: end,
        stepName: ref.stepId ? placed?.step.description?.trim() || ref.stepId : undefined,
        dedupeKey: `pen:${task.id}:${start.toISOString()}`,
      })
    }
    return null
  }
  const base = workingOnNowBlockNote(ref)
  const notes =
    mergeSittingNote({
      existing: undefined,
      base,
      owned: true,
      replaceOwned: true,
      startedAt: start,
      endedAt: end,
      spans: ref.pauseSpans,
      stopped: true,
    }) ?? base
  const entry: TimeLogEntry = {
    id: `tl-${end.getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    date: formatLocalDateKey(start),
    startTime: formatLocalHhmm(start),
    endTime: formatLocalHhmm(end),
    durationMinutes: minutes,
    notes,
    taskId: task.id,
    ...(ref.stepId ? { stepId: ref.stepId } : {}),
    ...(ref.trackingEntryIds?.length ? { entryIds: [...ref.trackingEntryIds] } : {}),
    ...(ref.pauseSpans?.length ? { pauseSpans: ref.pauseSpans.map((span) => ({ ...span })) } : {}),
  }
  useTaskStore.getState().updateTask({ ...task, timeLogs: [...(task.timeLogs ?? []), entry] })
  return entry
}

/**
 * Tick or reopen what an objective stands for. A step objective that only
 * "counts toward" its step leaves the step alone; its minutes still land on
 * the step through the block's `stepId`. A task-level one finishes the task.
 */
export function applyObjectiveToStep(ref: ClockTaskRef, objective: NowObjective): void {
  const task = getTask(objective.taskId ?? ref.taskId)
  if (!task || !objectiveCompletesTarget(objective)) return
  if (!objective.stepId) {
    if (!!task.completed === !!objective.completedAt) return
    useTaskStore.getState().updateTask({
      ...task,
      completed: !!objective.completedAt,
      completedDate: objective.completedAt ? new Date(objective.completedAt) : undefined,
    })
    return
  }
  if (!placeSteps(task.subtasks).some((p) => p.step.id === objective.stepId)) return
  let subtasks: Subtask[]
  if (objective.completedAt) {
    const done = new Date(objective.completedAt)
    const ms = objectiveWorkedMs(objective)
    const minutes = ms == null ? undefined : ms / 60_000
    subtasks = finishStep(task.subtasks, objective.stepId, minutes != null && minutes >= 0.5 ? minutes : undefined, done)
  } else {
    subtasks = updateNestedStep(task.subtasks, objective.stepId, { completed: false })
  }
  useTaskStore.getState().updateTask({ ...task, subtasks })
}

/**
 * The open step a typed objective most likely names: an exact name first,
 * then a name that contains the text or is contained in it (4+ letters).
 */
export function matchStepForObjective(taskId: string | undefined, text: string): string | undefined {
  const task = getTask(taskId)
  if (!task) return undefined
  const needle = text.trim().toLowerCase()
  if (!needle) return undefined
  const open = placeSteps(task.subtasks).filter((p) => !p.step.completed)
  const exact = open.find((p) => p.step.description.trim().toLowerCase() === needle)
  if (exact) return exact.step.id
  if (needle.length < 4) return undefined
  const loose = open.find((p) => {
    const name = p.step.description.trim().toLowerCase()
    return name.length >= 4 && (name.includes(needle) || needle.includes(name))
  })
  return loose?.step.id
}

/** Open steps of the clock's task, labelled with their path, for a "which step" menu. */
export function openStepChoices(taskId: string | undefined): { id: string; label: string }[] {
  const task = getTask(taskId)
  if (!task) return []
  return placeSteps(task.subtasks)
    .filter((p) => !p.step.completed)
    .map((p) => ({
      id: p.step.id,
      label: [...p.path.map((s) => s.description), p.step.description].join(" › "),
    }))
}

/**
 * Make a new step for an objective, as a sibling of the step on the clock
 * (top level when none). Returns the new step id.
 */
export function addStepForObjective(ref: ClockTaskRef, objective: NowObjective): string | undefined {
  const task = getTask(ref.taskId)
  if (!task) return undefined
  const path = ref.stepId ? stepPath(task.subtasks, ref.stepId) : null
  const parentId = path && path.length ? path[path.length - 1].id : null
  const before = new Set(placeSteps(task.subtasks).map((p) => p.step.id))
  let subtasks = addNestedStep(task.subtasks, parentId, { description: objective.text })
  const made = placeSteps(subtasks).find((p) => !before.has(p.step.id))
  if (!made) return undefined
  if (objective.completedAt) {
    const done = new Date(objective.completedAt)
    const ms = objectiveWorkedMs(objective)
    const minutes = ms == null ? undefined : ms / 60_000
    subtasks = finishStep(subtasks, made.step.id, minutes != null && minutes >= 0.5 ? minutes : undefined, done)
  }
  useTaskStore.getState().updateTask({ ...task, subtasks })
  return made.step.id
}

/**
 * Stopping the sitting paints the block again and can replace its id.
 * Logs that named the old id should name the block that is still there.
 */
export function retargetClockLogs(taskId: string, fromIds: readonly string[], toIds: readonly string[]): void {
  if (!fromIds.length || !toIds.length) return
  const task = getTask(taskId)
  if (!task?.timeLogs?.length) return
  const from = new Set(fromIds)
  const to = new Set(toIds)
  let changed = false
  const timeLogs = task.timeLogs.map((log) => {
    const named = log.entryIds ?? []
    if (!named.some((id) => from.has(id)) || named.every((id) => to.has(id))) return log
    changed = true
    return { ...log, entryIds: [...toIds] }
  })
  if (changed) useTaskStore.getState().updateTask({ ...task, timeLogs })
}

/** An active task starts reading "in progress" once it is on the clock. */
export function markTaskInProgress(taskId: string | undefined): void {
  const task = getTask(taskId)
  if (!task || task.completed) return
  if (task.status && task.status !== "active") return
  useTaskStore.getState().updateTask({ ...task, status: "partial" })
}
