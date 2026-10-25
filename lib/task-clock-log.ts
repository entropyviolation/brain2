/**
 * lib/task-clock-log.ts — What a pen clock writes back onto its task
 *
 * When a task is on the Tracking pen clock (`lib/task-clock.ts`), these keep
 * the task in step with the clock:
 * - stopping logs one `timeLogs` entry for the span, with the step and the
 *   painted entry ids, so a total can skip the paint it already counted;
 * - an objective tied to a step ticks (or reopens) that step, with the
 *   objective's own span as the step's actual minutes;
 * - a typed objective is matched to an open step by name;
 * - free objectives can be kept as steps.
 *
 * Imported by `lib/pen-color-session.ts`, so it must not import that module.
 */
import type { Subtask, Task, TimeLogEntry } from "@/lib/types"
import { objectiveCompletesTarget, type NowObjective } from "@/lib/now-objective"
import { useTaskStore } from "@/lib/task-store"
import { formatLocalDateKey } from "@/lib/date-utils"
import { finishStep, placeSteps, stepPath } from "@/lib/next-step"
import { addNestedStep, updateNestedStep } from "@/lib/todo-steps"
import { itemTitleOrUntitled } from "@/lib/item-utils"

export interface ClockTaskRef {
  taskId?: string
  stepId?: string
  trackingEntryIds?: string[]
}

function getTask(taskId: string | undefined): Task | undefined {
  if (!taskId) return undefined
  return useTaskStore.getState().tasks.find((t) => t.id === taskId)
}

function hhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
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

/** Write one time log for a clock span. Under a minute writes nothing. */
export function logTaskClockSpan(ref: ClockTaskRef, start: Date, end: Date, activeMs: number): TimeLogEntry | null {
  const task = getTask(ref.taskId)
  if (!task) return null
  const minutes = Math.round(activeMs / 60_000)
  if (minutes < 1) return null
  const entry: TimeLogEntry = {
    id: `tl-${end.getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    date: formatLocalDateKey(start),
    startTime: hhmm(start),
    endTime: hhmm(end),
    durationMinutes: minutes,
    notes: `Clock · ${clockPathLabel(task, ref.stepId)}`,
    taskId: task.id,
    ...(ref.stepId ? { stepId: ref.stepId } : {}),
    ...(ref.trackingEntryIds?.length ? { entryIds: [...ref.trackingEntryIds] } : {}),
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
  const task = getTask(ref.taskId)
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
    const minutes = (done.getTime() - new Date(objective.addedAt).getTime()) / 60_000
    subtasks = finishStep(task.subtasks, objective.stepId, minutes >= 0.5 ? minutes : undefined, done)
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
    const minutes = (done.getTime() - new Date(objective.addedAt).getTime()) / 60_000
    subtasks = finishStep(subtasks, made.step.id, minutes >= 0.5 ? minutes : undefined, done)
  }
  useTaskStore.getState().updateTask({ ...task, subtasks })
  return made.step.id
}

/** An active task starts reading "in progress" once it is on the clock. */
export function markTaskInProgress(taskId: string | undefined): void {
  const task = getTask(taskId)
  if (!task || task.completed) return
  if (task.status && task.status !== "active") return
  useTaskStore.getState().updateTask({ ...task, status: "partial" })
}
