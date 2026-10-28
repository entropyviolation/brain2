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
 * - A step played while the task sitting is already up (no step of its own,
 *   or step timers already beside it) starts a subclock for that step. The
 *   parent clock and the pen block stay as they are. Stopping that step logs
 *   only its timer. Stopping the task logs every subclock, then the sitting.
 * - An active task turns "in progress".
 *
 * Stop is the pen clock's Stop: the span is logged on the task there.
 *
 * While the clock is already running, the header and the desk can put a task
 * on it, move which step is current, add a step, or finish the task and stop.
 * The painted minutes stay one block. The block's note names the task and
 * what this sitting finished.
 */
import type { Subtask, Task } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { usePenColorSessionStore, type PenColorSession } from "@/lib/pen-color-session-store"
import { runAsAction } from "@/lib/action-history"
import { completeTask } from "@/lib/services/completion-service"
import {
  addPenColorNowObjective,
  setPenColorSessionTask,
  startPenColorSession,
  stopPenColorSession,
  stopPenSubclock,
  togglePenColorNowObjectiveComplete,
} from "@/lib/pen-color-session"
import { activeNowObjectives } from "@/lib/now-objective"
import { findPlacedStep, placeSteps, stepPath } from "@/lib/next-step"
import { addNestedStep } from "@/lib/todo-steps"
import { createTaskForObjective } from "@/lib/unfinished-objectives"
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

/** The live clock, when it is on this task (and step, when given). A subclock counts. */
export function isTaskOnClock(taskId: string, stepId?: string): boolean {
  const session = usePenColorSessionStore.getState().session
  if (!session || session.taskId !== taskId) return false
  if (!stepId) return true
  if (session.stepId === stepId) return true
  return session.subclocks?.some((row) => row.stepId === stepId) ?? false
}

/**
 * The task sitting is already the parent clock: it has no step of its own,
 * or step timers are already running beside it. A further step play nests.
 */
function parentSittingUp(taskId: string): boolean {
  const live = usePenColorSessionStore.getState().session
  if (!live || live.taskId !== taskId) return false
  return !live.stepId || (live.subclocks?.length ?? 0) > 0
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
  if (step && parentSittingUp(taskId)) {
    return runAsAction("step on the clock", () => {
      const current = usePenColorSessionStore.getState().session
      if (!current) return { kind: "missing" as const }
      const subclocks = current.subclocks ?? []
      if (!subclocks.some((row) => row.stepId === step.id)) {
        usePenColorSessionStore.getState().setSession({
          ...current,
          subclocks: [...subclocks, { stepId: step.id, startedAt: now.toISOString() }],
        })
      }
      markTaskInProgress(taskId)
      return { kind: "switched" as const, session: usePenColorSessionStore.getState().session! }
    })
  }

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
    if (!already) addPenColorNowObjective(step.description, now, step.id, "now")
  }

  return { kind, session: usePenColorSessionStore.getState().session! }
}

/** Stop one step timer. The task sitting keeps going. False when that step has no timer of its own. */
export function stopTaskSubclock(stepId: string, now = new Date()): boolean {
  return stopPenSubclock(stepId, now)
}

/** Stop the clock if it is on this task. Returns the sitting that just closed. Step timers are logged first. */
export function stopTaskClock(taskId?: string, now = new Date(), opts?: { parkUnfinished?: boolean }): PenColorSession | null {
  const session = usePenColorSessionStore.getState().session
  if (!session) return null
  if (taskId && session.taskId !== taskId) return null
  return stopPenColorSession(now, opts)
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

function liveClock() {
  return usePenColorSessionStore.getState().session
}

function clockTask(taskId: string | undefined): Task | undefined {
  if (!taskId) return undefined
  return useTaskStore.getState().tasks.find((task) => task.id === taskId)
}

/** Put this task on the clock that is already running. The block is not split. */
export function assignTaskOnClock(taskId: string, stepId?: string): StartTaskClockResult {
  const live = liveClock()
  return runAsAction("task on the clock", () =>
    startTaskClock(taskId, {
      stepId,
      penId: live?.penId,
      rememberPen: !!live?.penId,
    }),
  )
}

/** Make a task named from the field and put it on the live clock, linked to this pen. */
export function createTaskOnClock(name: string): string | null {
  const live = liveClock()
  if (!live) return null
  return runAsAction("task on the clock", () => {
    const id = createTaskForObjective(name, { scopeId: live.scopeId, penId: live.penId })
    if (!id) return null
    startTaskClock(id, { penId: live.penId })
    return id
  })
}

/** The step this sitting is on. Passing none clears it. The block stays one block. */
export function setClockStep(stepId: string | undefined): void {
  const live = liveClock()
  const task = clockTask(live?.taskId)
  if (!live?.taskId || !task) return
  runAsAction("step on the clock", () => {
    setPenColorSessionTask({ taskId: task.id, stepId, title: itemTitle(task) || live.title })
    if (!stepId) return
    const step = findPlacedStep(task.subtasks, stepId)?.step
    const session = usePenColorSessionStore.getState().session
    const already = activeNowObjectives(session?.nowObjectives).some((row) => row.stepId === step?.id)
    if (step && !already) addPenColorNowObjective(step.description, new Date(), step.id, "now")
  })
}

/** A new step beside the one on the clock (or at the top, when none is). It becomes the current step. */
export function addClockStep(description: string): string | undefined {
  const text = description.trim()
  const live = liveClock()
  const task = clockTask(live?.taskId)
  if (!text || !live?.taskId || !task) return undefined
  return runAsAction("step on the clock", () => {
    const path = live.stepId ? stepPath(task.subtasks, live.stepId) : null
    const parentId = path?.length ? path[path.length - 1].id : null
    const before = new Set(placeSteps(task.subtasks).map((placed) => placed.step.id))
    const subtasks = addNestedStep(task.subtasks, parentId, { description: text })
    useTaskStore.getState().updateTask({ ...task, subtasks })
    const made = placeSteps(subtasks).find((placed) => !before.has(placed.step.id))
    if (!made) return undefined
    setPenColorSessionTask({ taskId: task.id, stepId: made.step.id, title: itemTitle(task) || live.title })
    addPenColorNowObjective(made.step.description, new Date(), made.step.id, "now")
    return made.step.id
  })
}

/**
 * Finish this step and move the clock to the next open one.
 * The minutes stay on the one block. The finished step stays on it through its objective.
 */
export function completeClockStep(stepId: string): void {
  const live = liveClock()
  const task = clockTask(live?.taskId)
  if (!live?.taskId || !task) return
  const step = findPlacedStep(task.subtasks, stepId)?.step
  if (!step || step.completed) return
  const finishedIndex = placeSteps(task.subtasks).findIndex((placed) => placed.step.id === stepId)
  runAsAction("complete the step on the clock", () => {
    const session = usePenColorSessionStore.getState().session
    const row = session?.nowObjectives?.find((item) => item.stepId === stepId && !item.completedAt)
    if (row) togglePenColorNowObjectiveComplete(row.id)
    else {
      addPenColorNowObjective(step.description, new Date(), stepId, "now")
      const added = usePenColorSessionStore.getState().session?.nowObjectives?.find(
        (item) => item.stepId === stepId && !item.completedAt,
      )
      if (added) togglePenColorNowObjectiveComplete(added.id)
    }
    const fresh = clockTask(live.taskId)
    if (!fresh) return
    const after = placeSteps(fresh.subtasks)
    const next =
      after.find((placed, index) => !placed.step.completed && index > finishedIndex) ??
      after.find((placed) => !placed.step.completed)
    if (!next) {
      setPenColorSessionTask({ taskId: fresh.id, title: itemTitle(fresh) || live.title })
      return
    }
    setPenColorSessionTask({ taskId: fresh.id, stepId: next.step.id, title: itemTitle(fresh) || live.title })
    const open = activeNowObjectives(usePenColorSessionStore.getState().session?.nowObjectives)
    if (!open.some((item) => item.stepId === next.step.id)) {
      addPenColorNowObjective(next.step.description, new Date(), next.step.id, "now")
    }
  })
}

/** Mark the task on the clock complete, then stop. One undo step. Returns the sitting. */
export function finishClockTask(park: boolean, now = new Date()): PenColorSession | null {
  const live = liveClock()
  if (!live) return null
  const taskId = live.taskId
  let ended: PenColorSession | null = null
  runAsAction("finish the task on the clock", () => {
    if (taskId) completeTask(taskId)
    ended = stopPenColorSession(now, park ? { parkUnfinished: true } : undefined)
  })
  return ended
}
