/**
 * lib/focus-timer-log.ts — Module focus timer → Task.timeLogs
 *
 * When a Modules board countdown completes, append a `timeLogs` slice onto
 * Working Now's current item. If nothing is being worked, the UI asks which
 * item. Writes go through `taskRepository`. This does not paint Tracking, does
 * not stop Working Now, and does not pick 25:5 vs 52:17 from cognitive load.
 */
import type { Task, TimeLogEntry } from "@/lib/types"
import { taskRepository } from "@/lib/data/task-repository"
import { itemTitle } from "@/lib/item-utils"
import { isOperation } from "@/lib/operations"
import {
  splitIntoDaySlices,
  type WorkDaySlice,
} from "@/lib/operation-work-session"
import { minutesToTimeString } from "@/lib/time-entries"
import { useWorkSessionStore } from "@/lib/work-session-store"
import { runAsAction } from "@/lib/action-history"

export const FOCUS_TIMER_ACTIVITY = "focus timer"

export interface FocusTimerPickOption {
  id: string
  title: string
}

export function focusTimerLogId(taskId: string, startedAtIso: string, date: string): string {
  return `focus-log-${taskId}-${startedAtIso}-${date}`
}

/** Working Now's operation id, or null when the clock is idle. */
export function workingNowTaskId(): string | null {
  return useWorkSessionStore.getState().session?.operationId ?? null
}

export function resolveFocusTimerTaskId(): string | null {
  const id = workingNowTaskId()
  if (!id) return null
  return taskRepository.getById(id) ? id : null
}

export function focusTimerPickOptions(tasks: Task[]): FocusTimerPickOption[] {
  const ops: FocusTimerPickOption[] = []
  const open: FocusTimerPickOption[] = []
  for (const task of tasks) {
    if (task.loggedAction) continue
    const title = itemTitle(task) || "Untitled"
    if (isOperation(task) && !task.completed) {
      ops.push({ id: task.id, title })
      continue
    }
    if (!task.completed) open.push({ id: task.id, title })
  }
  return [...ops, ...open]
}

export function buildFocusTimerTimeLog(input: {
  taskId: string
  slice: WorkDaySlice
  startedAtIso: string
}): TimeLogEntry {
  return {
    id: focusTimerLogId(input.taskId, input.startedAtIso, input.slice.date),
    date: input.slice.date,
    startTime: minutesToTimeString(input.slice.startMin),
    endTime: minutesToTimeString(input.slice.endMin),
    durationMinutes: input.slice.durationMinutes,
    notes: FOCUS_TIMER_ACTIVITY,
    activityLabel: FOCUS_TIMER_ACTIVITY,
    taskId: input.taskId,
  }
}

export function appendFocusTimerTimeLogs(input: {
  taskId: string
  durationMinutes: number
  endedAt?: Date
}): TimeLogEntry[] | null {
  return runAsAction("focus timer", () => {
    const task = taskRepository.getById(input.taskId)
    if (!task) return null
    const duration = Math.max(1, Math.round(input.durationMinutes))
    const endedAt = input.endedAt ?? new Date()
    const startedAt = new Date(endedAt.getTime() - duration * 60_000)
    const startedAtIso = startedAt.toISOString()
    const slices = splitIntoDaySlices(startedAt, endedAt)
    let nextLogs = [...(task.timeLogs ?? [])]
    const written: TimeLogEntry[] = []
    for (const slice of slices) {
      const log = buildFocusTimerTimeLog({ taskId: task.id, slice, startedAtIso })
      const idx = nextLogs.findIndex((entry) => entry.id === log.id)
      if (idx >= 0) nextLogs[idx] = log
      else nextLogs = [...nextLogs, log]
      written.push(log)
    }
    const actualDuration = nextLogs.reduce((sum, log) => sum + log.durationMinutes, 0)
    const latest = taskRepository.getById(task.id)
    if (!latest) return null
    taskRepository.update({ ...latest, timeLogs: nextLogs, actualDuration })
    return written
  })
}

export function completeFocusTimer(
  durationMinutes: number,
  endedAt?: Date,
): { taskId: string | null; logs: TimeLogEntry[] | null; needsPick: boolean } {
  const taskId = resolveFocusTimerTaskId()
  if (!taskId) return { taskId: null, logs: null, needsPick: true }
  const logs = appendFocusTimerTimeLogs({ taskId, durationMinutes, endedAt })
  return { taskId, logs, needsPick: false }
}
