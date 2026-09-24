/**
 * lib/completion-events.ts — Task completion event bus
 *
 * A tiny pub/sub so the central completion path (task-store.updateTask) can
 * notify the UI whenever a task transitions to completed — regardless of which
 * screen completed it (checkbox, list, scheduler, …). The global completion
 * popup subscribes here so it appears on *every* completion.
 *
 * Batch paths (Scheduler selection Mark complete) can wrap work in
 * `runWithoutCompletionPopup` so points and archive lists still run while the
 * modal queue stays quiet.
 */
"use client"

export interface TaskCompletedEvent {
  taskId: string
  /** Base points awarded by the store for this completion (before objective multipliers). */
  basePoints: number
  at: Date
  /**
   * Checklist (and other confirm-first) completions: the task is still open.
   * Save / Skip apply the completion; Undo / overlay cancel leave it incomplete.
   */
  pending?: boolean
}

type Listener = (event: TaskCompletedEvent) => void

const listeners = new Set<Listener>()
let suppressPopupDepth = 0

/** Subscribe to task-completed events. Returns an unsubscribe function. */
export function onTaskCompleted(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** True when callers should emit the global completion popup. */
export function shouldEmitCompletionPopup(): boolean {
  return suppressPopupDepth === 0
}

/**
 * Run a completion batch without queuing the global popup. Points and status
 * still update through the normal store path.
 */
export function runWithoutCompletionPopup<T>(fn: () => T): T {
  suppressPopupDepth++
  try {
    return fn()
  } finally {
    suppressPopupDepth--
  }
}

/** Emit a task-completed event to all subscribers. */
export function emitTaskCompleted(event: TaskCompletedEvent): void {
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      // A misbehaving listener must not break the completion path.
    }
  }
}

/** Open the reflection dialog before flipping `completed`. */
export function requestTaskCompletion(taskId: string, basePoints = 0): void {
  emitTaskCompleted({ taskId, basePoints, at: new Date(), pending: true })
}
