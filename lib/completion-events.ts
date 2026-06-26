/**
 * lib/completion-events.ts — Task completion event bus
 *
 * A tiny pub/sub so the central completion path (task-store.updateTask) can
 * notify the UI whenever a task transitions to completed — regardless of which
 * screen completed it (checkbox, list, scheduler, …). The global completion
 * popup subscribes here so it appears on *every* completion.
 */
"use client"

export interface TaskCompletedEvent {
  taskId: string
  /** Base points awarded by the store for this completion (before objective multipliers). */
  basePoints: number
  at: Date
}

type Listener = (event: TaskCompletedEvent) => void

const listeners = new Set<Listener>()

/** Subscribe to task-completed events. Returns an unsubscribe function. */
export function onTaskCompleted(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
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
