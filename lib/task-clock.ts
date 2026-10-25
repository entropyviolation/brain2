/**
 * lib/task-clock.ts — Put a task (and a step) on the Tracking pen clock
 *
 * One clock, the existing pen-color "Working on right now"
 * (`lib/pen-color-session.ts`). This adds which task and step it is for:
 *
 * - The pen is the task's first linked pen (`Task.penLinks`). With none, a
 *   pen already on the clock keeps going and takes the task. With neither,
 *   the caller has to ask for a pen (`needs-pen`); `rememberPen` saves the
 *   answer on the task.
 * - Starting on the pen already live does not split the block. Only the task
 *   and step change, and the new step is stamped as an objective tied to it.
 * - An active task turns "in progress".
 *
 * Stop is the pen clock's Stop: the span is logged on the task there.
 */
import type { Subtask, Task } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { usePenColorSessionStore, type PenColorSession } from "@/lib/pen-color-session-store"
import {
  addPenColorNowObjective,
  setPenColorSessionTask,
  startPenColorSession,
  stopPenColorSession,
} from "@/lib/pen-color-session"
import { activeNowObjectives } from "@/lib/now-objective"
import { findPlacedStep } from "@/lib/next-step"
import { markTaskInProgress } from "@/lib/task-clock-log"
import { itemTitle } from "@/lib/item-utils"

export type StartTaskClockResult =
  | { kind: "started"; session: PenColorSession }
  | { kind: "switched"; session: PenColorSession }
  | { kind: "needs-pen" }
  | { kind: "missing" }

function penExists(penId: string): { scopeId: string } | null {
  for (const scope of useTimeTrackingStore.getState().scopes) {
    if (scope.pens.some((pen) => pen.id === penId)) return { scopeId: scope.id }
  }
  return null
}

type PenLink = { scopeId: string; penId: string }

/**
 * A step's pens: its own, else the nearest parent step's, else the task's.
 * `from` names where they came from (`null` = the task). Pure.
 */
export function stepPenLinks(
  task: Pick<Task, "penLinks" | "subtasks"> | undefined,
  stepId: string | undefined,
): { links: PenLink[]; from: Subtask | null; own: boolean } {
  const trail: Subtask[] = []
  const walk = (list: readonly Subtask[] | undefined): boolean => {
    for (const s of list ?? []) {
      trail.push(s)
      if (s.id === stepId || walk(s.subtasks)) return true
      trail.pop()
    }
    return false
  }
  if (stepId) walk(task?.subtasks)
  for (let i = trail.length - 1; i >= 0; i--) {
    const links = trail[i].penLinks
    if (links) return { links, from: trail[i], own: i === trail.length - 1 }
  }
  return { links: task?.penLinks ?? [], from: null, own: !stepId }
}

/** The clock pen: the first linked pen that still exists, on the step (inherited) or the task. */
export function clockPenFor(task: Pick<Task, "penLinks" | "subtasks"> | undefined, stepId?: string): { scopeId: string; penId: string } | undefined {
  for (const link of stepPenLinks(task, stepId).links) {
    const found = penExists(link.penId)
    if (found) return { scopeId: found.scopeId, penId: link.penId }
  }
  return undefined
}

/** Put this pen first on the task's links. */
export function rememberTaskPen(taskId: string, penId: string): void {
  const store = useTaskStore.getState()
  const task = store.tasks.find((t) => t.id === taskId)
  const found = penExists(penId)
  if (!task || !found) return
  const rest = (task.penLinks ?? []).filter((link) => link.penId !== penId)
  store.updateTask({ ...task, penLinks: [{ scopeId: found.scopeId, penId }, ...rest] })
}

/** The live clock, when it is on this task (and step, when given). */
export function isTaskOnClock(taskId: string, stepId?: string): boolean {
  const session = usePenColorSessionStore.getState().session
  if (!session || session.taskId !== taskId) return false
  return stepId ? session.stepId === stepId : true
}

export function startTaskClock(
  taskId: string,
  options: { stepId?: string; penId?: string; rememberPen?: boolean; now?: Date } = {},
): StartTaskClockResult {
  const now = options.now ?? new Date()
  const task = useTaskStore.getState().tasks.find((t) => t.id === taskId)
  if (!task) return { kind: "missing" }
  const step = options.stepId ? findPlacedStep(task.subtasks, options.stepId)?.step : undefined

  const live = usePenColorSessionStore.getState().session
  const penId = options.penId ?? clockPenFor(task, options.stepId)?.penId ?? live?.penId
  if (!penId) return { kind: "needs-pen" }
  if (options.penId && options.rememberPen) rememberTaskPen(taskId, options.penId)

  let kind: "started" | "switched" = "switched"
  if (!live || live.penId !== penId) {
    // A different task on the clock is stopped (and logged) first by startPenColorSession.
    if (!startPenColorSession(penId, now)) return { kind: "needs-pen" }
    kind = "started"
  } else if (live.taskId && live.taskId !== taskId) {
    // Same pen, other task: close that task's span so each task keeps its own time.
    stopPenColorSession(now)
    if (!startPenColorSession(penId, now)) return { kind: "needs-pen" }
    kind = "started"
  }

  setPenColorSessionTask({ taskId, stepId: step?.id, title: itemTitle(task) })
  markTaskInProgress(taskId)

  if (step) {
    const session = usePenColorSessionStore.getState().session
    const already = activeNowObjectives(session?.nowObjectives).find((row) => row.stepId === step.id)
    if (!already) addPenColorNowObjective(step.description, now, step.id)
  }

  return { kind, session: usePenColorSessionStore.getState().session! }
}

/** Stop the clock if it is on this task. */
export function stopTaskClock(taskId?: string, now = new Date(), opts?: { parkUnfinished?: boolean }): void {
  const session = usePenColorSessionStore.getState().session
  if (!session) return
  if (taskId && session.taskId !== taskId) return
  stopPenColorSession(now, opts)
}

/** Tasks linked to this pen (`Task.penLinks`), in list order. Pure. */
export function tasksLinkedToPen<T extends Pick<Task, "penLinks">>(tasks: readonly T[], penId: string): T[] {
  return tasks.filter((task) => task.penLinks?.some((link) => link.penId === penId))
}

/** Link or unlink one pen on a task, from pen settings. A new link goes last, so the clock pen stays. */
export function setTaskPenLinked(taskId: string, scopeId: string, penId: string, linked: boolean): void {
  const store = useTaskStore.getState()
  const task = store.tasks.find((t) => t.id === taskId)
  if (!task) return
  const rest = (task.penLinks ?? []).filter((link) => link.penId !== penId)
  const next = linked ? [...rest, { scopeId, penId }] : rest
  store.updateTask({ ...task, penLinks: next.length ? next : undefined })
}
