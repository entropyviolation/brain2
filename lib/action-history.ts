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
 * completions, points, tasks). Sleep sync and habit-tracking sync rewrite
 * derived rows after a paint; restoring only the grid would let them resurrect
 * the stroke. Capturing the cluster means one Cmd+Z returns the Home dashboard
 * to the moment before the action.
 *
 * The grid commits on the keydown. Tracking entries, scopes, tags, and the
 * removal tombstones land synchronously. Sleep, habits, points, and tasks are
 * the same snapshot, applied on the next turn so a coverage scan cannot sit
 * in front of the paint. `isRestoring()` stays set until that bookkeeping
 * finishes, so a listener cannot write the stroke back after the flag would
 * have dropped. Tests apply the whole snapshot before `undoLastAction` returns.
 *
 * An undone block is listed in `removedEntryIds`. The persist union, a late
 * rehydrate, and any later `entries` write that still carries that id all
 * drop it. Redo clears the tombstone in the same setState, so the block stays.
 *
 * Snapshots keep the *references* the stores already hold. Every write here
 * replaces those objects rather than mutating them, so the previous array is
 * still the previous state. `withoutUndo` silences ticks and other bookkeeping
 * that should not become their own undo steps. `runAsAction` collapses a burst
 * (Mon–Fri fill, start/stop work) into one step.
 *
 * Derived sync (sleep, habits, pen actions, coverage) must read `isRestoring()`
 * and stand down. A restore already contains the world from before the action;
 * letting those listeners rewrite entries or nights on the way back re-applies
 * the stroke and can recurse until the tab stops painting. A nested
 * undo/redo during the apply is ignored. A later chord flushes any deferred
 * bookkeeping and then pops the next step.
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
  /** Snapshot this step restores. Deferred log writes may append to it. */
  world?: WorldSnap
  seq: number
  onUndo?: () => void
  onRedo?: () => void
  /**
   * Entry ids this snapshot must not gain. A transfer's before-image shares
   * one set with the undo/redo copies of that same step.
   */
  omitEntryIds?: Set<string>
}

let undoStack: HistoryAction[] = []
let redoStack: HistoryAction[] = []
/** Inside the synchronous apply. A nested undo/redo returns without popping. */
let applying = false
/**
 * Tracking is already restored and the rest of the snapshot is waiting for the
 * next turn. Writers still stand down. A new chord flushes this first.
 */
let settling = false
let silenced = 0
let batchDepth = 0
let recordedThisBatch = false
let nextSeq = 1

const REMOVED_ENTRY_CAP = 4000

type WorldSnap = {
  entries: ReturnType<typeof useTimeTrackingStore.getState>["entries"]
  scopes: ReturnType<typeof useTimeTrackingStore.getState>["scopes"]
  tags: ReturnType<typeof useTimeTrackingStore.getState>["tags"]
  removedEntryIds: string[]
  nights: ReturnType<typeof useSleepStore.getState>["nights"]
  session: ReturnType<typeof useWorkSessionStore.getState>["session"]
  penSession: ReturnType<typeof usePenColorSessionStore.getState>["session"]
  weeklyData: ReturnType<typeof useHabitsStore.getState>["weeklyData"]
  weeklyHabitData: ReturnType<typeof useHabitsStore.getState>["weeklyHabitData"]
  monthlyHabitData: ReturnType<typeof useHabitsStore.getState>["monthlyHabitData"]
  quarterlyHabitData: ReturnType<typeof useHabitsStore.getState>["quarterlyHabitData"]
  pointsHistory: ReturnType<typeof usePointsStore.getState>["pointsHistory"]
  tasks: ReturnType<typeof useTaskStore.getState>["tasks"]
}

let pendingBook: (() => void) | null = null
let bookTimer: ReturnType<typeof setTimeout> | null = null

function capRemoved(ids: Set<string>): string[] {
  const list = [...ids]
  return list.length > REMOVED_ENTRY_CAP ? list.slice(list.length - REMOVED_ENTRY_CAP) : list
}

/** Ids the live grid no longer has must stay tombstoned so a union cannot repaint them. */
function applyTracking(snap: WorldSnap): void {
  const current = useTimeTrackingStore.getState()
  const live = new Set(snap.entries.map((entry) => entry.id))
  const removed = new Set(snap.removedEntryIds)
  for (const entry of current.entries) {
    if (!live.has(entry.id)) removed.add(entry.id)
  }
  for (const id of live) removed.delete(id)
  useTimeTrackingStore.setState({
    entries: snap.entries,
    scopes: snap.scopes,
    tags: snap.tags,
    removedEntryIds: capRemoved(removed),
  })
}

function applyBookkeeping(snap: WorldSnap): void {
  useSleepStore.setState({ nights: snap.nights })
  useWorkSessionStore.setState({ session: snap.session })
  usePenColorSessionStore.setState({ session: snap.penSession })
  useHabitsStore.setState({
    weeklyData: snap.weeklyData,
    weeklyHabitData: snap.weeklyHabitData,
    monthlyHabitData: snap.monthlyHabitData,
    quarterlyHabitData: snap.quarterlyHabitData,
  })
  usePointsStore.setState({ pointsHistory: snap.pointsHistory })
  useTaskStore.setState({ tasks: snap.tasks })
}

/** Browser keydowns paint the grid before habit/points/task bookkeeping. Tests stay synchronous. */
function deferBookkeeping(): boolean {
  return typeof window !== "undefined" && process.env.NODE_ENV !== "test"
}

function flushDeferred(): void {
  if (bookTimer != null) {
    clearTimeout(bookTimer)
    bookTimer = null
  }
  const book = pendingBook
  pendingBook = null
  if (!book) {
    settling = false
    return
  }
  applying = true
  try {
    book()
  } finally {
    applying = false
    settling = true
    queueMicrotask(() => {
      if (pendingBook || applying) return
      settling = false
    })
  }
}

function scheduleBookkeeping(book: () => void): void {
  pendingBook = book
  settling = true
  if (bookTimer != null) clearTimeout(bookTimer)
  bookTimer = setTimeout(() => {
    bookTimer = null
    flushDeferred()
  }, 0)
}

function captureWorld(): { restore: () => void; world: WorldSnap } {
  const tracking = useTimeTrackingStore.getState()
  const habits = useHabitsStore.getState()
  const snap: WorldSnap = {
    entries: tracking.entries,
    scopes: tracking.scopes,
    tags: tracking.tags,
    removedEntryIds: tracking.removedEntryIds ?? [],
    nights: useSleepStore.getState().nights,
    session: useWorkSessionStore.getState().session,
    penSession: usePenColorSessionStore.getState().session,
    weeklyData: habits.weeklyData,
    weeklyHabitData: habits.weeklyHabitData,
    monthlyHabitData: habits.monthlyHabitData,
    quarterlyHabitData: habits.quarterlyHabitData,
    pointsHistory: usePointsStore.getState().pointsHistory,
    tasks: useTaskStore.getState().tasks,
  }

  return {
    world: snap,
    restore: () => {
      applyTracking(snap)
      const book = () => applyBookkeeping(snap)
      if (deferBookkeeping()) scheduleBookkeeping(book)
      else book()
    },
  }
}

function pushUndo(action: Omit<HistoryAction, "seq">): HistoryAction {
  const stored: HistoryAction = { ...action, seq: nextSeq++ }
  undoStack.push(stored)
  if (undoStack.length > MAX_ACTION_HISTORY) undoStack.shift()
  redoStack = []
  return stored
}

function carryHooks(action: HistoryAction): Pick<HistoryAction, "onUndo" | "onRedo" | "omitEntryIds"> {
  return {
    onUndo: action.onUndo,
    onRedo: action.onRedo,
    omitEntryIds: action.omitEntryIds,
  }
}

/**
 * True while a restore is applying or its deferred bookkeeping has not landed.
 * Nested writes must not push a step or repaint the grid from the stroke that
 * was just undone. A nested undo/redo is ignored only for the synchronous apply;
 * `undoLastAction` flushes deferred bookkeeping and then pops.
 */
export function isRestoring(): boolean {
  return applying || settling
}

/**
 * Snapshot the Home/Tracking cluster and push it as one undo step. No-op while
 * restoring, silenced, or already captured inside `runAsAction`.
 */
export function rememberWorld(label: string): void {
  if (applying || settling || silenced > 0) return
  if (batchDepth > 0 && recordedThisBatch) return

  const captured = captureWorld()
  pushUndo({ label, restore: captured.restore, world: captured.world })
  if (batchDepth > 0) recordedThisBatch = true
}

/**
 * Hooks for the undo step just pushed. `omitEntryIds` is shared by later
 * undo/redo copies of that same step so a deferred log write is not spliced
 * back into the before-image.
 */
export function attachLatestUndoHooks(hooks: {
  onUndo?: () => void
  onRedo?: () => void
  omitEntryIds?: Set<string>
}): number | undefined {
  const action = undoStack[undoStack.length - 1]
  if (!action) return undefined
  if (hooks.onUndo) action.onUndo = hooks.onUndo
  if (hooks.onRedo) action.onRedo = hooks.onRedo
  if (hooks.omitEntryIds) action.omitEntryIds = hooks.omitEntryIds
  return action.seq
}

/** Mutate world snapshots taken after `seq`. The step at `seq` stays as it was. */
export function patchWorldsAfter(
  seq: number,
  patch: (world: WorldSnap, action: HistoryAction) => void,
): void {
  for (const action of undoStack) {
    if (action.world && action.seq > seq) patch(action.world, action)
  }
  for (const action of redoStack) {
    if (action.world && action.seq > seq) patch(action.world, action)
  }
}

/**
 * Run several mutations as a single undo step. The snapshot is taken once, at
 * the start, before any of `fn` writes.
 */
export function runAsAction<T>(label: string, fn: () => T): T {
  if (applying || settling || silenced > 0) return fn()
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
  // A listener that runs because this restore wrote state must not pop again.
  if (applying) return false
  flushDeferred()
  const action = undoStack.pop()
  if (!action) return false
  const captured = captureWorld()
  action.onUndo?.()
  applying = true
  try {
    action.restore()
  } finally {
    applying = false
  }
  redoStack.push({
    label: action.label,
    restore: captured.restore,
    world: captured.world,
    seq: nextSeq++,
    ...carryHooks(action),
  })
  return true
}

export function redoLastAction(): boolean {
  if (applying) return false
  flushDeferred()
  const action = redoStack.pop()
  if (!action) return false
  const captured = captureWorld()
  applying = true
  try {
    action.restore()
  } finally {
    applying = false
  }
  action.onRedo?.()
  undoStack.push({
    label: action.label,
    restore: captured.restore,
    world: captured.world,
    seq: nextSeq++,
    ...carryHooks(action),
  })
  if (undoStack.length > MAX_ACTION_HISTORY) undoStack.shift()
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
  if (bookTimer != null) clearTimeout(bookTimer)
  bookTimer = null
  pendingBook = null
  undoStack = []
  redoStack = []
  applying = false
  settling = false
  silenced = 0
  batchDepth = 0
  recordedThisBatch = false
  nextSeq = 1
}
