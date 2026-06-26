/**
 * lib/needs-attention.ts — "Needs Attention" queue selector (Phase 6b)
 *
 * A PURE, deterministic selector that scans a list of tasks and surfaces the
 * ones that need the user's attention, each annotated with one or more
 * machine-readable reasons. It has NO side effects: it never mutates tasks,
 * touches the store, or runs behavioral rules. The Home dashboard's
 * `NeedsAttention` card consumes this; tests exercise it with plain arrays.
 *
 * Reasons (all deterministic):
 *   - overdue:     has a `deadline` in the past and is not completed.
 *   - unclarified: `category === "inbox"` (the GTD inbox / unclarified bucket).
 *   - blocked:     has `dependencies` where at least one referenced task (resolved
 *                  against the passed `tasks`) is not yet completed.
 *   - stale:       not scheduled and `createdAt` is older than `opts.staleDays`.
 *
 * Completed tasks are always excluded. Thresholds are configurable via `opts`.
 *
 * Spec: surfacing work that has slipped (overdue / stale) or is stuck (blocked /
 * unclarified). See docs/SPEC_MAPPING.md for the broader GTD lifecycle.
 */
import type { Task } from "@/lib/types"
import { safeToDate, taskHasNoSchedule } from "@/lib/date-utils"

/** A single machine-readable reason a task is surfaced in the queue. */
export type NeedsAttentionReason = "overdue" | "unclarified" | "blocked" | "stale"

/** A task flagged for attention together with the reasons that flagged it. */
export interface NeedsAttentionEntry {
  item: Task
  reasons: NeedsAttentionReason[]
}

export interface NeedsAttentionOptions {
  /**
   * Age (in days) after which an unscheduled, incomplete task is considered
   * `stale`. A task is stale when `now - createdAt` is strictly greater than
   * this many days. Defaults to 14.
   */
  staleDays?: number
  /** Reference "now" for deterministic testing. Defaults to `new Date()`. */
  now?: Date
  /**
   * Which reasons to evaluate. Defaults to all four. Useful to scope the queue
   * (e.g. only `overdue` + `blocked`) without changing call sites.
   */
  reasons?: NeedsAttentionReason[]
}

const DEFAULT_STALE_DAYS = 14
const MS_PER_DAY = 24 * 60 * 60 * 1000
const ALL_REASONS: NeedsAttentionReason[] = ["overdue", "unclarified", "blocked", "stale"]

/** Human-friendly labels for each reason (for badges / a11y). */
export const NEEDS_ATTENTION_REASON_LABELS: Record<NeedsAttentionReason, string> = {
  overdue: "Overdue",
  unclarified: "Unclarified",
  blocked: "Blocked",
  stale: "Stale",
}

function isOverdue(task: Task, now: Date): boolean {
  const deadline = safeToDate(task.deadline)
  return !!deadline && deadline.getTime() < now.getTime()
}

function isUnclarified(task: Task): boolean {
  return task.stage === "inbox"
}

function isBlocked(task: Task, completedById: Map<string, boolean>): boolean {
  const deps = task.dependencies
  if (!deps || deps.length === 0) return false
  // Blocked when at least one dependency is unknown or not yet completed.
  return deps.some((depId) => completedById.get(depId) !== true)
}

function isStale(task: Task, now: Date, staleDays: number): boolean {
  if (!taskHasNoSchedule(task)) return false
  const created = safeToDate(task.createdAt)
  if (!created) return false
  const ageDays = (now.getTime() - created.getTime()) / MS_PER_DAY
  return ageDays > staleDays
}

/**
 * Scan `tasks` and return the subset that needs attention, each with its
 * reasons. Completed tasks are excluded. The result preserves input order and
 * only includes tasks with at least one reason.
 */
export function getNeedsAttention(
  tasks: Task[],
  opts: NeedsAttentionOptions = {},
): NeedsAttentionEntry[] {
  const staleDays = opts.staleDays ?? DEFAULT_STALE_DAYS
  const now = opts.now ?? new Date()
  const enabled = new Set(opts.reasons ?? ALL_REASONS)

  // Index completion by id so `blocked` can resolve dependencies in O(1).
  const completedById = new Map<string, boolean>()
  for (const t of tasks) completedById.set(t.id, !!t.completed)

  const entries: NeedsAttentionEntry[] = []

  for (const task of tasks) {
    if (task.completed) continue

    const reasons: NeedsAttentionReason[] = []
    if (enabled.has("overdue") && isOverdue(task, now)) reasons.push("overdue")
    if (enabled.has("unclarified") && isUnclarified(task)) reasons.push("unclarified")
    if (enabled.has("blocked") && isBlocked(task, completedById)) reasons.push("blocked")
    if (enabled.has("stale") && isStale(task, now, staleDays)) reasons.push("stale")

    if (reasons.length > 0) entries.push({ item: task, reasons })
  }

  return entries
}

/**
 * Convenience: group flagged entries by reason. An entry with multiple reasons
 * appears under each of its reason groups. Useful for the grouped card UI.
 */
export function groupNeedsAttentionByReason(
  entries: NeedsAttentionEntry[],
): Record<NeedsAttentionReason, NeedsAttentionEntry[]> {
  const groups: Record<NeedsAttentionReason, NeedsAttentionEntry[]> = {
    overdue: [],
    unclarified: [],
    blocked: [],
    stale: [],
  }
  for (const entry of entries) {
    for (const reason of entry.reasons) groups[reason].push(entry)
  }
  return groups
}
