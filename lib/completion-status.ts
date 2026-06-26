/**
 * lib/completion-status.ts — Richer completion status helpers (Feature 9)
 *
 * A task carries a coarse boolean `completed` (the legacy lifecycle flag) and an
 * optional richer `CompletionStatus` (active / partial / deferred / cancelled /
 * done). These two MUST agree on the single hard invariant:
 *
 *   status === "done"  ⇔  completed === true
 *
 * Every other status (active/partial/deferred/cancelled) implies
 * `completed === false`. The pure helpers here are the only place that knows how
 * to keep the two fields in sync, so callers should always go through
 * `withStatus` / `withCompleted` (then persist via
 * `useTaskStore.getState().updateTask`) rather than poking the fields directly.
 *
 * Everything here is pure (no React / store access) so it is trivially testable
 * and reusable across the To-Do panel and the legacy item-detail popups.
 */
import type { CompletionStatus, Task } from "@/lib/types"

/** All statuses, ordered for display in selects (open → resolved). */
export const COMPLETION_STATUSES: readonly CompletionStatus[] = [
  "active",
  "partial",
  "deferred",
  "cancelled",
  "done",
] as const

/** Short, human-friendly label for each status. */
export const COMPLETION_STATUS_LABELS: Record<CompletionStatus, string> = {
  active: "Active",
  partial: "Partial",
  deferred: "Deferred",
  cancelled: "Cancelled",
  done: "Done",
}

/** One-line description for tooltips / option hints. */
export const COMPLETION_STATUS_DESCRIPTIONS: Record<CompletionStatus, string> = {
  active: "Open and ready to work on",
  partial: "Started — some progress made, not finished",
  deferred: "Postponed for now; revisit later",
  cancelled: "Abandoned — will not be done",
  done: "Completed",
}

/** Tailwind badge classes per status (mirrors the tier colour convention). */
export function getStatusColor(status: CompletionStatus): string {
  switch (status) {
    case "done":
      return "bg-green-100 text-green-800 border-green-200"
    case "partial":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "deferred":
      return "bg-amber-100 text-amber-800 border-amber-200"
    case "cancelled":
      return "bg-gray-100 text-gray-500 border-gray-200 line-through"
    case "active":
    default:
      return "bg-slate-100 text-slate-800 border-slate-200"
  }
}

// Statuses that represent open work the user can still act on.
const OPEN_STATUSES: ReadonlySet<CompletionStatus> = new Set<CompletionStatus>(["active", "partial"])
// Statuses that close the task out (no further work expected).
const RESOLVED_STATUSES: ReadonlySet<CompletionStatus> = new Set<CompletionStatus>(["done", "cancelled"])

/** Is `value` one of the known completion statuses? */
export function isCompletionStatus(value: unknown): value is CompletionStatus {
  return typeof value === "string" && (COMPLETION_STATUSES as readonly string[]).includes(value)
}

/**
 * The status to display for a task, deriving a sensible default from the legacy
 * `completed` flag when no explicit `status` is stored. An explicit status is
 * authoritative (see `normalizeTask` for reconciling inconsistent records).
 */
export function effectiveStatus(task: Pick<Task, "status" | "completed">): CompletionStatus {
  if (isCompletionStatus(task.status)) return task.status
  return task.completed ? "done" : "active"
}

/** Whether the task's effective status satisfies the done ⇔ completed invariant. */
export function isConsistent(task: Pick<Task, "status" | "completed">): boolean {
  const status = effectiveStatus(task)
  return (status === "done") === (task.completed === true)
}

/**
 * Return a copy of `task` with `status` set and `completed` brought into sync so
 * the invariant always holds. This is the canonical way to change a status.
 */
export function withStatus<T extends Pick<Task, "status" | "completed">>(task: T, status: CompletionStatus): T {
  return { ...task, status, completed: status === "done" }
}

/**
 * Return a copy of `task` with the legacy `completed` flag toggled and `status`
 * kept in sync. Completing forces "done"; un-completing reverts a "done" task to
 * "active" but preserves any other open/closed status already set.
 */
export function withCompleted<T extends Pick<Task, "status" | "completed">>(task: T, completed: boolean): T {
  if (completed) return { ...task, completed: true, status: "done" }
  const current = task.status
  const next: CompletionStatus = isCompletionStatus(current) && current !== "done" ? current : "active"
  return { ...task, completed: false, status: next }
}

/**
 * Reconcile a possibly-inconsistent task so the invariant holds. The explicit
 * `status` wins when present; otherwise the legacy `completed` flag drives it.
 * Useful when reading legacy/imported data.
 */
export function normalizeTask<T extends Pick<Task, "status" | "completed">>(task: T): T {
  return withStatus(task, effectiveStatus(task))
}

// ---- Status classification predicates -------------------------------------

export function isDone(task: Pick<Task, "status" | "completed">): boolean {
  return effectiveStatus(task) === "done"
}

export function isActive(task: Pick<Task, "status" | "completed">): boolean {
  return effectiveStatus(task) === "active"
}

export function isPartial(task: Pick<Task, "status" | "completed">): boolean {
  return effectiveStatus(task) === "partial"
}

export function isDeferred(task: Pick<Task, "status" | "completed">): boolean {
  return effectiveStatus(task) === "deferred"
}

export function isCancelled(task: Pick<Task, "status" | "completed">): boolean {
  return effectiveStatus(task) === "cancelled"
}

/** Open = still actionable work (active or partial). */
export function isOpen(task: Pick<Task, "status" | "completed">): boolean {
  return OPEN_STATUSES.has(effectiveStatus(task))
}

/** Resolved = closed out (done or cancelled). */
export function isResolved(task: Pick<Task, "status" | "completed">): boolean {
  return RESOLVED_STATUSES.has(effectiveStatus(task))
}

// ---- Availability (dependency-aware) --------------------------------------

function toTaskMap(tasks: Iterable<Task> | Map<string, Task>): Map<string, Task> {
  if (tasks instanceof Map) return tasks
  const map = new Map<string, Task>()
  for (const t of tasks) map.set(t.id, t)
  return map
}

/**
 * Is this task blocked by an unresolved dependency? A dependency is considered
 * satisfied when it is resolved (done or cancelled) or no longer present.
 */
export function isBlocked(task: Task, tasks: Iterable<Task> | Map<string, Task>): boolean {
  const deps = task.dependencies ?? []
  if (deps.length === 0) return false
  const byId = toTaskMap(tasks)
  return deps.some((depId) => {
    const dep = byId.get(depId)
    return dep ? !isResolved(dep) : false
  })
}

/**
 * "Active & available": an open task (active/partial) with every dependency
 * satisfied. This is the headline filter for "what can I actually do right now".
 */
export function isAvailable(task: Task, tasks: Iterable<Task> | Map<string, Task>): boolean {
  return isOpen(task) && !isBlocked(task, tasks)
}

// ---- Transitions -----------------------------------------------------------

/** Allowed next statuses from each status (excludes the no-op self-transition). */
export const STATUS_TRANSITIONS: Record<CompletionStatus, readonly CompletionStatus[]> = {
  active: ["partial", "deferred", "cancelled", "done"],
  partial: ["active", "deferred", "cancelled", "done"],
  deferred: ["active", "partial", "cancelled", "done"],
  cancelled: ["active"],
  done: ["active"],
}

/** Statuses reachable from `from` (does not include `from` itself). */
export function allowedTransitions(from: CompletionStatus): readonly CompletionStatus[] {
  return STATUS_TRANSITIONS[from] ?? []
}

/** Is moving from one status to another permitted? Self-transitions are false. */
export function canTransition(from: CompletionStatus, to: CompletionStatus): boolean {
  if (from === to) return false
  return allowedTransitions(from).includes(to)
}
