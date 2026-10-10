/**
 * lib/completion-status.ts — Richer completion status helpers (Feature 9)
 *
 * A task carries a coarse boolean `completed` (the legacy lifecycle flag) and an
 * optional richer `CompletionStatus` (active / partial / deferred / cancelled /
 * missed / done). These two MUST agree on the single hard invariant:
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
import { parseLocalDate } from "@/lib/date-utils"
import type { CompletionStatus, Task } from "@/lib/types"

/** All statuses, ordered for display in selects (open → resolved). */
export const COMPLETION_STATUSES: readonly CompletionStatus[] = [
  "active",
  "partial",
  "deferred",
  "cancelled",
  "missed",
  "done",
] as const

/** Short, human-friendly label for each status. */
export const COMPLETION_STATUS_LABELS: Record<CompletionStatus, string> = {
  active: "Active",
  partial: "Partial",
  deferred: "Deferred",
  cancelled: "Cancelled",
  missed: "Missed opportunity",
  done: "Done",
}

/** One-line description for tooltips / option hints. */
export const COMPLETION_STATUS_DESCRIPTIONS: Record<CompletionStatus, string> = {
  active: "Open and ready to work on",
  partial: "Started — some progress made, not finished",
  deferred: "Postponed for now; revisit later",
  cancelled: "Abandoned — will not be done",
  missed: "Too late — the window closed without doing it",
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
    case "missed":
      return "bg-orange-100 text-orange-900 border-orange-200"
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
const RESOLVED_STATUSES: ReadonlySet<CompletionStatus> = new Set<CompletionStatus>(["done", "cancelled", "missed"])
// Done or too-late: leave To Do / Next Actions and land on an archive list.
const CLEARED_FROM_WORK_STATUSES: ReadonlySet<CompletionStatus> = new Set<CompletionStatus>(["done", "missed"])

/** Is `value` one of the known completion statuses? */
export function isCompletionStatus(value: unknown): value is CompletionStatus {
  return typeof value === "string" && (COMPLETION_STATUSES as readonly string[]).includes(value)
}

/**
 * Read a persisted `status` as a completion status.
 *
 * Older vaults stored the lifecycle bucket here (`inbox` / `clarified` /
 * `scheduled` / `list`) before `stage` existed, and used the word `completed`
 * for finished work. Those are not `CompletionStatus`. Stage words become
 * "no status" (`completed` still decides active vs done). The word `completed`
 * becomes `"done"`.
 */
export function storedCompletionStatus(value: unknown): CompletionStatus | undefined {
  if (isCompletionStatus(value)) return value
  if (typeof value !== "string") return undefined
  const raw = value.trim().toLowerCase()
  if (raw === "completed" || raw === "complete") return "done"
  if (raw === "canceled") return "cancelled"
  if (isCompletionStatus(raw)) return raw
  return undefined
}

/**
 * Drop a leftover stage word on `status`, or rewrite `completed` → `done`.
 * A record that already has a real completion status is returned as-is.
 */
export function repairStoredTaskStatus<T extends { status?: unknown; completed?: boolean }>(task: T): T {
  if (!task || typeof task !== "object" || !("status" in task) || task.status === undefined) return task
  if (isCompletionStatus(task.status)) return task
  const next = storedCompletionStatus(task.status)
  if (next === undefined) {
    const { status: _dropped, ...rest } = task
    return rest as T
  }
  if (next === "done") return { ...task, status: next, completed: true }
  return { ...task, status: next }
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
export function withStatus<T extends Pick<Task, "status" | "completed" | "missedAt">>(
  task: T,
  status: CompletionStatus,
  now: Date = new Date(),
): T {
  const next: T = { ...task, status, completed: status === "done" }
  if (status === "missed") {
    return { ...next, missedAt: task.missedAt ?? now }
  }
  const cleared: T = "missedAt" in next || task.missedAt ? { ...next, missedAt: undefined } : next
  if (!("missReason" in cleared)) return cleared
  const copy = { ...cleared }
  delete (copy as { missReason?: unknown }).missReason
  return copy
}

/**
 * Return a copy of `task` with the legacy `completed` flag toggled and `status`
 * kept in sync. Completing forces "done"; un-completing reverts a "done" task to
 * "active" but preserves any other open/closed status already set.
 */
export function withCompleted<T extends Pick<Task, "status" | "completed" | "missedAt">>(
  task: T,
  completed: boolean,
): T {
  if (completed) return withStatus(task, "done")
  const current = task.status
  const next: CompletionStatus =
    isCompletionStatus(current) && current !== "done" && current !== "missed" ? current : "active"
  return withStatus(task, next)
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

export function isMissed(task: Pick<Task, "status" | "completed">): boolean {
  return effectiveStatus(task) === "missed"
}

/** Open = still actionable work (active or partial). */
export function isOpen(task: Pick<Task, "status" | "completed">): boolean {
  return OPEN_STATUSES.has(effectiveStatus(task))
}

/** Resolved = closed out (done, cancelled, or missed). */
export function isResolved(task: Pick<Task, "status" | "completed">): boolean {
  return RESOLVED_STATUSES.has(effectiveStatus(task))
}

/**
 * Left the active work queues (To Do, Next Actions smart lists, Scheduler).
 * Done goes to Completed; missed goes to Missed Opportunities.
 */
export function isClearedFromWork(task: Pick<Task, "status" | "completed">): boolean {
  if (task.completed) return true
  return CLEARED_FROM_WORK_STATUSES.has(effectiveStatus(task))
}

/** When the work was finished. Completed rows fall back to the scheduled day, then created. */
export function getTaskCompletionDate(task: Task): Date | null {
  if (task.completedDate) {
    const d = task.completedDate instanceof Date ? task.completedDate : new Date(task.completedDate)
    if (!isNaN(d.getTime())) return d
  }
  const review = task.completionReview?.completedAt
  if (review) {
    const d = review instanceof Date ? review : new Date(review)
    if (!isNaN(d.getTime())) return d
  }
  const chunks = task.completedChunks
  if (chunks && chunks.length > 0) {
    const last = chunks[chunks.length - 1].date
    const d = last instanceof Date ? last : new Date(last)
    if (!isNaN(d.getTime())) return d
  }
  if (task.completed) {
    const sched = task.scheduledDate ? parseLocalDate(task.scheduledDate) : null
    if (sched) return sched
    return task.createdAt instanceof Date ? task.createdAt : new Date(task.createdAt)
  }
  return null
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
  active: ["partial", "deferred", "cancelled", "missed", "done"],
  partial: ["active", "deferred", "cancelled", "missed", "done"],
  deferred: ["active", "partial", "cancelled", "missed", "done"],
  cancelled: ["active"],
  missed: ["active", "done"],
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
