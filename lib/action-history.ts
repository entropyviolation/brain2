/**
 * lib/action-history.ts — Last-action undo / redo for Home and Tracking
 *
 * Cmd/Ctrl-Z should reverse the stroke you just painted, the habit cell you
 * mis-clicked, or the sleep times you just typed — not the text caret inside an
 * input. This module is the in-memory stack those surfaces push onto *before*
 * they mutate. The hotkey in `hooks/useUndoHotkey.ts` pops it.
 *
 * One snapshot covers the stores that chase each other (Tracking entries, the
 * sleep log, the live work session, the live pen-color session, habit
 * completions, points, tasks). Sleep
 * sync and habit-tracking sync rewrite derived rows after a paint; restoring
 * only the grid would let them resurrect the stroke. Capturing the cluster
 * means one Cmd+Z returns the Home dashboard to the moment before the action.
 *
 * Snapshots keep the *references* the stores already hold. Every write here
 * replaces those objects rather than mutating them, so the previous array is
 * still the previous state. `withoutUndo` silences ticks and other bookkeeping
 * that should not become their own undo steps. `runAsAction` collapses a burst
 * (Mon–Fri fill, start/stop work) into one step.
 */
"use client"

import { useHabitsStore } from "@/lib/habits-store"
import { usePointsStore } from "@/lib/points-store"
import { useSleepStore } from "@/lib/sleep-store"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useWorkSessionStore } from "@/lib/work-session-store"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"

export const MAX_ACTION_HISTORY = 40

export interface HistoryAction {
  label: string
  restore: () => void
}

let undoStack: HistoryAction[] = []
let redoStack: HistoryAction[] = []
let restoring = false
let silenced = 0
let batchDepth = 0
let recordedThisBatch = false

function captureWorld(): () => void {
  const tracking = useTimeTrackingStore.getState()
  const nights = useSleepStore.getState().nights
  const session = useWorkSessionStore.getState().session
  const penSession = usePenColorSessionStore.getState().session
  const habits = useHabitsStore.getState()
  const pointsHistory = usePointsStore.getState().pointsHistory
  const tasks = useTaskStore.getState().tasks

  const entries = tracking.entries
  const scopes = tracking.scopes
  const tags = tracking.tags
  const weeklyData = habits.weeklyData
  const weeklyHabitData = habits.weeklyHabitData
  const monthlyHabitData = habits.monthlyHabitData

  return () => {
    useTimeTrackingStore.setState({ entries, scopes, tags })
    useSleepStore.setState({ nights })
    useWorkSessionStore.setState({ session })
    usePenColorSessionStore.setState({ session: penSession })
    useHabitsStore.setState({ weeklyData, weeklyHabitData, monthlyHabitData })
    usePointsStore.setState({ pointsHistory })
    useTaskStore.setState({ tasks })
  }
}

/** True while a restore is applying, so nested writes do not push a new step. */
export function isRestoring(): boolean {
  return restoring
}

/**
 * Snapshot the Home/Tracking cluster and push it as one undo step. No-op while
 * restoring, silenced, or already captured inside `runAsAction`.
 */
export function rememberWorld(label: string): void {
  if (restoring || silenced > 0) return
  if (batchDepth > 0 && recordedThisBatch) return

  undoStack.push({ label, restore: captureWorld() })
  if (undoStack.length > MAX_ACTION_HISTORY) undoStack.shift()
  redoStack = []
  if (batchDepth > 0) recordedThisBatch = true
}

/**
 * Run several mutations as a single undo step. The snapshot is taken once, at
 * the start, before any of `fn` writes.
 */
export function runAsAction<T>(label: string, fn: () => T): T {
  if (restoring || silenced > 0) return fn()
  batchDepth++
  try {
    rememberWorld(label)
    return fn()
  } finally {
    batchDepth--
    if (batchDepth === 0) recordedThisBatch = false
  }
}

/** Run `fn` without pushing undo (work-session ticks, derived sync writes). */
export function withoutUndo<T>(fn: () => T): T {
  silenced++
  try {
    return fn()
  } finally {
    silenced--
  }
}

export function undoLastAction(): boolean {
  const action = undoStack.pop()
  if (!action) return false
  const redoRestore = captureWorld()
  restoring = true
  try {
    action.restore()
  } finally {
    restoring = false
  }
  redoStack.push({ label: action.label, restore: redoRestore })
  return true
}

export function redoLastAction(): boolean {
  const action = redoStack.pop()
  if (!action) return false
  const undoRestore = captureWorld()
  restoring = true
  try {
    action.restore()
  } finally {
    restoring = false
  }
  undoStack.push({ label: action.label, restore: undoRestore })
  return true
}

export function canUndo(): boolean {
  return undoStack.length > 0
}

export function canRedo(): boolean {
  return redoStack.length > 0
}

export function peekUndoLabel(): string | undefined {
  return undoStack[undoStack.length - 1]?.label
}

export function peekRedoLabel(): string | undefined {
  return redoStack[redoStack.length - 1]?.label
}

/** Tests and store resets. */
export function resetActionHistory(): void {
  undoStack = []
  redoStack = []
  restoring = false
  silenced = 0
  batchDepth = 0
  recordedThisBatch = false
}
