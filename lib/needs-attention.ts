/**
 * lib/needs-attention.ts — "Needs Attention" queue selector (Phase 6b)
 *
 * A PURE, deterministic selector that scans items and surfaces the ones that
 * need the user's attention, each annotated with one or more machine-readable
 * reasons. It has NO side effects: it never mutates tasks, touches the store,
 * or runs behavioral rules. The Home dashboard's `NeedsAttention` card consumes
 * this; tests exercise it with plain arrays.
 *
 * Reasons (all deterministic):
 *   - overdue:     has a `deadline` in the past and is still open work
 *                  (not done, not a missed opportunity).
 *   - unclarified: `stage === "inbox"` and not Monkey brain (the revisit pile).
 *   - blocked:     has `dependencies` where at least one referenced task (resolved
 *                  against the passed `tasks`) is still open work.
 *   - stale:       not scheduled and `createdAt` is older than `opts.staleDays`.
 *   - neglected:   a goal / operation / list item with no recent linked work.
 *                  Reuses `goalsNeedingAttention` and operation tree + time-log
 *                  math; does not copy DirectionReport or the operation heatmap UI.
 *   - zombie:      a long-resident next-action task: high `daysPushed` /
 *                  `weeksPushed`, or high entropy and old.
 *
 * Done and missed-opportunity tasks are always excluded. Thresholds are configurable via `opts`.
 *
 * Spec: surfacing work that has slipped (overdue / stale) or is stuck (blocked /
 * unclarified), plus neglected structures and zombie tasks. See
 * docs/SPEC_MAPPING.md for the broader GTD lifecycle.
 */
import type { Goal, Task } from "@/lib/types"
import { safeToDate, taskHasNoSchedule } from "@/lib/date-utils"
import { addStepsAsSubtasks, parseSteps } from "@/lib/molecular"
import {
  goalsNeedingAttention,
  type ActionRecord,
} from "@/lib/objectives"
import {
  getOperationTaskTree,
  isOperation,
} from "@/lib/operations"
import { OPERATION_ATTR } from "@/lib/operation-types"
import { isClearedFromWork } from "@/lib/completion-status"

/** A single machine-readable reason a task is surfaced in the queue. */
export type NeedsAttentionReason =
  | "overdue"
  | "unclarified"
  | "blocked"
  | "stale"
  | "neglected"
  | "zombie"

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
  /**
   * Days without linked work after which a goal / operation / list item is
   * `neglected`. Also the minimum age when there has never been linked work.
   * Defaults to `staleDays` (14).
   */
  neglectDays?: number
  /** `daysPushed` at or above this flags `zombie`. Defaults to 7. */
  zombieDaysPushed?: number
  /** `weeksPushed` at or above this flags `zombie`. Defaults to 3. */
  zombieWeeksPushed?: number
  /** Entropy at or above this, with long residence, flags `zombie`. Defaults to 0.7. */
  zombieEntropy?: number
  /** Age (days) that counts as long-resident when entropy is high. Defaults to 21. */
  zombieResidentDays?: number
  /** Reference "now" for deterministic testing. Defaults to `new Date()`. */
  now?: Date
  /**
   * Which reasons to evaluate. Defaults to all six. Useful to scope the queue
   * (e.g. only `overdue` + `blocked`) without changing call sites.
   */
  reasons?: NeedsAttentionReason[]
  /**
   * Life-direction goals (goals-store). Used only for `neglected`. Operations
   * and list items are read from `tasks`.
   */
  goals?: Goal[]
}

const DEFAULT_STALE_DAYS = 14
const DEFAULT_ZOMBIE_DAYS_PUSHED = 7
const DEFAULT_ZOMBIE_WEEKS_PUSHED = 3
const DEFAULT_ZOMBIE_ENTROPY = 0.7
const DEFAULT_ZOMBIE_RESIDENT_DAYS = 21
const MS_PER_DAY = 24 * 60 * 60 * 1000
const ALL_REASONS: NeedsAttentionReason[] = [
  "overdue",
  "unclarified",
  "blocked",
  "stale",
  "neglected",
  "zombie",
]

/** Human-friendly labels for each reason (for badges / a11y). */
export const NEEDS_ATTENTION_REASON_LABELS: Record<NeedsAttentionReason, string> = {
  overdue: "Overdue",
  unclarified: "Unclarified",
  blocked: "Blocked",
  stale: "Stale",
  neglected: "Neglected",
  zombie: "Zombie",
}

const CLOSED_OPERATION_STAGES = new Set(["done", "abandoned"])

function isOverdue(task: Task, now: Date): boolean {
  const deadline = safeToDate(task.deadline)
  return !!deadline && deadline.getTime() < now.getTime()
}

function isUnclarified(task: Task): boolean {
  // Monkey brain is a dump, not a pile the user means to revisit.
  return task.stage === "inbox" && task.monkeyBrain !== true
}

function isBlocked(task: Task, clearedById: Map<string, boolean>): boolean {
  const deps = task.dependencies
  if (!deps || deps.length === 0) return false
  // Blocked when at least one dependency is unknown or still open work.
  return deps.some((depId) => clearedById.get(depId) !== true)
}

function isStale(task: Task, now: Date, staleDays: number): boolean {
  if (!taskHasNoSchedule(task)) return false
  const created = safeToDate(task.createdAt)
  if (!created) return false
  const ageDays = (now.getTime() - created.getTime()) / MS_PER_DAY
  return ageDays > staleDays
}

function ageDays(task: Pick<Task, "createdAt">, now: Date): number | null {
  const created = safeToDate(task.createdAt)
  if (!created) return null
  return (now.getTime() - created.getTime()) / MS_PER_DAY
}

function isListFurniture(task: Task): boolean {
  if (isOperation(task) || task.loggedAction || task.type === "action") return false
  return task.type === "item" || task.stage === "list"
}

function operationStage(task: Task): string {
  const raw = task.attributes?.[OPERATION_ATTR.stage]
  return typeof raw === "string" ? raw : ""
}

function isClosedOperation(task: Task): boolean {
  if (task.completed) return true
  return CLOSED_OPERATION_STAGES.has(operationStage(task))
}

function laterDate(a: Date | null, b: Date | null): Date | null {
  if (!a) return b
  if (!b) return a
  return a.getTime() >= b.getTime() ? a : b
}

function latestTimeLogDate(task: Task): Date | null {
  let latest: Date | null = null
  for (const log of task.timeLogs ?? []) {
    latest = laterDate(latest, safeToDate(log.date))
  }
  return latest
}

function lastOperationWorkDate(operation: Task, allTasks: Task[]): Date | null {
  const tree = [operation, ...getOperationTaskTree(operation.id, allTasks)]
  let latest: Date | null = null
  for (const node of tree) {
    latest = laterDate(latest, latestTimeLogDate(node))
    if (node.completed) latest = laterDate(latest, safeToDate(node.completedDate) ?? safeToDate(node.createdAt))
  }
  return latest
}

function lastLinkedWorkDate(itemId: string, actions: ActionRecord[]): Date | null {
  let latest: Date | null = null
  for (const action of actions) {
    if (!action.completed) continue
    const serves = (action.links ?? []).some((link) => link.targetId === itemId)
    if (!serves) continue
    const d = safeToDate(action.completedDate)
    latest = laterDate(latest, d)
  }
  return latest
}

function isPastNeglectWindow(
  lastWork: Date | null,
  createdAt: Date | string | undefined,
  now: Date,
  neglectDays: number,
): boolean {
  if (lastWork) {
    return (now.getTime() - lastWork.getTime()) / MS_PER_DAY > neglectDays
  }
  const created = safeToDate(createdAt)
  if (!created) return false
  return (now.getTime() - created.getTime()) / MS_PER_DAY > neglectDays
}

/**
 * Map tasks → ActionRecord the same way DirectionReport does (contribution
 * fields + typed links), so `goalsNeedingAttention` sees serving work.
 */
export function tasksToActionRecords(tasks: Task[]): ActionRecord[] {
  return tasks.map((t) => {
    const contributed = [
      ...(t.contributesToObjectiveIds ?? []),
      ...(t.contributesToGoalIds ?? []),
    ].map((targetId) => ({ id: `contrib-${t.id}-${targetId}`, relation: "action-of" as const, targetId }))
    return {
      id: t.id,
      completed: !!t.completed,
      completedDate: t.completedDate ?? t.completionReview?.completedAt ?? t.createdAt,
      links: [...(t.links ?? []), ...contributed],
    }
  })
}

function goalAsQueueItem(goal: Goal): Task {
  return {
    id: goal.id,
    description: goal.title,
    title: goal.title,
    stage: "list",
    type: "goal",
    createdAt: goal.createdAt,
    completed: goal.completed,
    lists: [],
  }
}

function isNeglectedStructure(
  task: Task,
  allTasks: Task[],
  actions: ActionRecord[],
  now: Date,
  neglectDays: number,
): boolean {
  if (task.loggedAction || task.type === "action") return false
  if (isOperation(task)) {
    if (isClosedOperation(task)) return false
    return isPastNeglectWindow(lastOperationWorkDate(task, allTasks), task.createdAt, now, neglectDays)
  }
  if (!isListFurniture(task)) return false
  const lastWork = laterDate(latestTimeLogDate(task), lastLinkedWorkDate(task.id, actions))
  return isPastNeglectWindow(lastWork, task.createdAt, now, neglectDays)
}

function isZombie(
  task: Task,
  now: Date,
  opts: {
    daysPushed: number
    weeksPushed: number
    entropy: number
    residentDays: number
  },
): boolean {
  if (task.loggedAction || task.type === "action") return false
  if (isOperation(task) || isListFurniture(task)) return false
  if ((task.daysPushed ?? 0) >= opts.daysPushed) return true
  if ((task.weeksPushed ?? 0) >= opts.weeksPushed) return true
  const entropy = task.entropy ?? 0
  const age = ageDays(task, now)
  return entropy >= opts.entropy && age !== null && age > opts.residentDays
}

function emptyGroups(): Record<NeedsAttentionReason, NeedsAttentionEntry[]> {
  return {
    overdue: [],
    unclarified: [],
    blocked: [],
    stale: [],
    neglected: [],
    zombie: [],
  }
}

/**
 * Scan `tasks` (and optional `opts.goals`) and return the subset that needs
 * attention, each with its reasons. Completed tasks are excluded. The result
 * preserves input order and only includes items with at least one reason.
 */
export function getNeedsAttention(
  tasks: Task[],
  opts: NeedsAttentionOptions = {},
): NeedsAttentionEntry[] {
  const staleDays = opts.staleDays ?? DEFAULT_STALE_DAYS
  const neglectDays = opts.neglectDays ?? staleDays
  const now = opts.now ?? new Date()
  const enabled = new Set(opts.reasons ?? ALL_REASONS)

  const clearedById = new Map<string, boolean>()
  for (const t of tasks) clearedById.set(t.id, isClearedFromWork(t))

  const actions = enabled.has("neglected") ? tasksToActionRecords(tasks) : []
  const byId = new Map<string, NeedsAttentionEntry>()
  const order: string[] = []

  const push = (item: Task, reason: NeedsAttentionReason) => {
    const existing = byId.get(item.id)
    if (existing) {
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason)
      return
    }
    byId.set(item.id, { item, reasons: [reason] })
    order.push(item.id)
  }

  for (const task of tasks) {
    if (isClearedFromWork(task)) continue

    if (enabled.has("overdue") && isOverdue(task, now)) push(task, "overdue")
    if (enabled.has("unclarified") && isUnclarified(task)) push(task, "unclarified")
    if (enabled.has("blocked") && isBlocked(task, clearedById)) push(task, "blocked")
    if (enabled.has("stale") && isStale(task, now, staleDays)) push(task, "stale")
    if (enabled.has("neglected") && isNeglectedStructure(task, tasks, actions, now, neglectDays)) {
      push(task, "neglected")
    }
    if (
      enabled.has("zombie") &&
      isZombie(task, now, {
        daysPushed: opts.zombieDaysPushed ?? DEFAULT_ZOMBIE_DAYS_PUSHED,
        weeksPushed: opts.zombieWeeksPushed ?? DEFAULT_ZOMBIE_WEEKS_PUSHED,
        entropy: opts.zombieEntropy ?? DEFAULT_ZOMBIE_ENTROPY,
        residentDays: opts.zombieResidentDays ?? DEFAULT_ZOMBIE_RESIDENT_DAYS,
      })
    ) {
      push(task, "zombie")
    }
  }

  if (enabled.has("neglected") && (opts.goals?.length ?? 0) > 0) {
    const staleGoals = goalsNeedingAttention(opts.goals, actions, { now, staleDays: neglectDays })
    for (const row of staleGoals) {
      if (!isPastNeglectWindow(row.lastActionDate, row.goal.createdAt, now, neglectDays)) continue
      const existingTask = tasks.find((t) => t.id === row.goal.id)
      if (existingTask?.completed) continue
      push(existingTask ?? goalAsQueueItem(row.goal), "neglected")
    }
  }

  return order.map((id) => byId.get(id)!).filter((e) => e.reasons.length > 0)
}

/**
 * Convenience: group flagged entries by reason. An entry with multiple reasons
 * appears under each of its reason groups. Useful for the grouped card UI.
 */
export function groupNeedsAttentionByReason(
  entries: NeedsAttentionEntry[],
): Record<NeedsAttentionReason, NeedsAttentionEntry[]> {
  const groups = emptyGroups()
  for (const entry of entries) {
    for (const reason of entry.reasons) groups[reason].push(entry)
  }
  return groups
}

/** Inbox-style clarify: leave the inbox; drop entropy so it stops reading as murky. */
export function clarifyNeedsAttentionItem(task: Task): Task {
  const stage =
    task.stage === "inbox" ? (task.lists?.length ? "clarified" : "list") : task.stage === "list" ? "list" : "clarified"
  return {
    ...task,
    stage,
    entropy: Math.min(task.entropy ?? 0.5, 0.3),
  }
}

/**
 * Split a zombie (or any queue item) into molecular steps from a free-form
 * block of text (one step per line). Returns null when nothing parsed.
 */
export function splitNeedsAttentionItem(task: Task, text: string): Task | null {
  const steps = parseSteps(text)
  if (steps.length === 0) return null
  return { ...task, subtasks: addStepsAsSubtasks(task.subtasks, steps) }
}
