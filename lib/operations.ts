/**
 * lib/operations.ts — Operation (directed enterprise) pure helpers (Feature 2)
 *
 * Pure, store-agnostic helpers behind the Operations workspace (Worker B):
 *
 *   - **Hours rollup** over `Task.timeLogs` (per task and across an operation).
 *   - **Phase-completion** evaluation (a phase's parts done / total).
 *   - **Work/neglect heatmap** data — per-day logged minutes over a date range,
 *     bucketed into intensity levels (level 0 = a neglected day).
 *   - **"To do next" selector** — the next actionable child tasks of an
 *     operation (incomplete, dependency-satisfied), ranked.
 *   - Relation resolution that reads an operation's phases/parts/resources from
 *     the typed links (`has-phase`/`phase-of`, etc.) in *both* directions.
 *
 * No store or React imports — everything takes plain `Task` arrays so it unit
 * tests cleanly. The components read the stores and hand data in here.
 */
import type { Task, TimeLogEntry } from "@/lib/types"
import { OPERATION_TYPE_ID } from "@/lib/operation-types"

/**
 * Relation ids the Operations feature uses (added to `lib/links.ts` upfront).
 * Each pair is written from the operation's perspective (`has*`) with the child
 * carrying the inverse (`*-of`); resolution checks both directions.
 */
export const OP_REL = {
  hasPhase: "has-phase",
  phaseOf: "phase-of",
  hasPart: "has-part",
  partOf: "part-of",
  hasResource: "has-resource",
  resourceOf: "resource-of",
} as const

/** True when a task is an Operation (directed enterprise). */
export function isOperation(task: Pick<Task, "type"> | null | undefined): boolean {
  return task?.type === OPERATION_TYPE_ID
}

// --- Hours rollup ----------------------------------------------------------

/** Total logged minutes on a single task (sum of `timeLogs[].durationMinutes`). */
export function loggedMinutes(task: Pick<Task, "timeLogs"> | null | undefined): number {
  const logs = task?.timeLogs ?? []
  return logs.reduce((sum, log) => sum + safeMinutes(log), 0)
}

/** Total logged minutes across many tasks (e.g. an operation + all its parts). */
export function rollupMinutes(tasks: Array<Pick<Task, "timeLogs">>): number {
  return tasks.reduce((sum, t) => sum + loggedMinutes(t), 0)
}

/** Logged minutes → hours, rounded to one decimal place. */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10
}

/** Convenience: total logged hours across many tasks. */
export function rollupHours(tasks: Array<Pick<Task, "timeLogs">>): number {
  return minutesToHours(rollupMinutes(tasks))
}

function safeMinutes(log: TimeLogEntry): number {
  const m = Number(log?.durationMinutes)
  return Number.isFinite(m) && m > 0 ? m : 0
}

// --- Relation resolution ---------------------------------------------------

/**
 * Resolve the child tasks an operation relates to via a forward/inverse
 * relation pair, in *both* link directions:
 *   - operation has a `forward` link → child, OR
 *   - child has an `inverse` link → operation.
 * De-duplicated by task id; self-references are excluded.
 */
export function getRelatedChildren(
  operationId: string,
  allTasks: Task[],
  forward: string,
  inverse: string,
): Task[] {
  const op = allTasks.find((t) => t.id === operationId)
  const forwardIds = new Set(
    (op?.links ?? []).filter((l) => l.relation === forward).map((l) => l.targetId),
  )
  const seen = new Set<string>()
  const out: Task[] = []
  for (const t of allTasks) {
    if (t.id === operationId) continue
    const linkedForward = forwardIds.has(t.id)
    const linkedInverse = (t.links ?? []).some(
      (l) => l.relation === inverse && l.targetId === operationId,
    )
    if ((linkedForward || linkedInverse) && !seen.has(t.id)) {
      seen.add(t.id)
      out.push(t)
    }
  }
  return out
}

/** Phase tasks of an operation (via `has-phase` / `phase-of`). */
export function getPhases(operationId: string, allTasks: Task[]): Task[] {
  return getRelatedChildren(operationId, allTasks, OP_REL.hasPhase, OP_REL.phaseOf)
}

/** Part / sub-tasks of an operation or phase (via `has-part` / `part-of`). */
export function getParts(parentId: string, allTasks: Task[]): Task[] {
  return getRelatedChildren(parentId, allTasks, OP_REL.hasPart, OP_REL.partOf)
}

/** Resource items attached to an operation (via `has-resource` / `resource-of`). */
export function getResources(operationId: string, allTasks: Task[]): Task[] {
  return getRelatedChildren(operationId, allTasks, OP_REL.hasResource, OP_REL.resourceOf)
}

/**
 * All descendant tasks of an operation that contribute to its time/progress:
 * its phases, their parts, and any direct parts — de-duplicated. The operation
 * itself is NOT included.
 */
export function getOperationTaskTree(operationId: string, allTasks: Task[]): Task[] {
  const seen = new Set<string>()
  const out: Task[] = []
  const add = (t: Task) => {
    if (!seen.has(t.id)) {
      seen.add(t.id)
      out.push(t)
    }
  }
  const phases = getPhases(operationId, allTasks)
  phases.forEach(add)
  getParts(operationId, allTasks).forEach(add)
  for (const phase of phases) {
    getParts(phase.id, allTasks).forEach(add)
  }
  return out
}

// --- Phase completion ------------------------------------------------------

export interface PhaseProgress {
  /** Number of part tasks in the phase. */
  total: number
  /** Number of completed part tasks. */
  done: number
  /** Completion fraction in [0, 1]. */
  fraction: number
  /** True when the phase is complete. */
  complete: boolean
}

/**
 * Evaluate a phase's completion from its part tasks. A phase with no parts is
 * complete iff the phase task itself is `completed`. Otherwise completion is the
 * fraction of completed parts, and the phase is complete when every part is.
 */
export function evaluatePhase(
  phase: Pick<Task, "completed">,
  parts: Array<Pick<Task, "completed">>,
): PhaseProgress {
  const total = parts.length
  if (total === 0) {
    const complete = !!phase.completed
    return { total: 0, done: complete ? 0 : 0, fraction: complete ? 1 : 0, complete }
  }
  const done = parts.filter((p) => p.completed).length
  const fraction = done / total
  return { total, done, fraction, complete: done === total }
}

/**
 * Overall operation progress = fraction of phases complete. Falls back to the
 * fraction of direct parts complete when there are no phases. Returns 0 when the
 * operation has neither phases nor parts.
 */
export function operationProgress(operationId: string, allTasks: Task[]): PhaseProgress {
  const phases = getPhases(operationId, allTasks)
  if (phases.length > 0) {
    const done = phases.filter((ph) => evaluatePhase(ph, getParts(ph.id, allTasks)).complete).length
    return {
      total: phases.length,
      done,
      fraction: done / phases.length,
      complete: done === phases.length,
    }
  }
  const parts = getParts(operationId, allTasks)
  return evaluatePhase({ completed: false }, parts)
}

// --- Work / neglect heatmap ------------------------------------------------

export type HeatLevel = 0 | 1 | 2 | 3 | 4

export interface HeatCell {
  /** Local calendar day, YYYY-MM-DD. */
  date: string
  /** Total logged minutes on that day across the provided tasks. */
  minutes: number
  /** Intensity bucket 0–4 (0 = a neglected day with no logged work). */
  level: HeatLevel
  /** Convenience flag: false when the day was neglected (no work). */
  worked: boolean
}

/** Default minute thresholds (exclusive upper bounds) for heat levels 1–3. */
export const DEFAULT_HEAT_THRESHOLDS = [30, 60, 120] as const

/** Bucket a day's logged minutes into an intensity level 0–4. */
export function heatLevel(
  minutes: number,
  thresholds: readonly [number, number, number] = DEFAULT_HEAT_THRESHOLDS,
): HeatLevel {
  if (minutes <= 0) return 0
  if (minutes <= thresholds[0]) return 1
  if (minutes <= thresholds[1]) return 2
  if (minutes <= thresholds[2]) return 3
  return 4
}

export interface HeatmapOptions {
  /** First day in the range (inclusive). Defaults to 30 days before `end`. */
  start?: Date
  /** Last day in the range (inclusive). Defaults to `now`. */
  end?: Date
  /** Number of trailing days when `start` is omitted (default 30). */
  days?: number
  /** Reference "today"; defaults to `new Date()`. */
  now?: Date
  thresholds?: readonly [number, number, number]
}

/**
 * Build per-day work/neglect heatmap cells over a date range from the time logs
 * of the provided tasks (typically an operation + its task tree). Every day in
 * the range gets a cell, so neglected days (level 0) are explicit.
 */
export function buildHeatmap(
  tasks: Array<Pick<Task, "timeLogs">>,
  options: HeatmapOptions = {},
): HeatCell[] {
  const now = options.now ?? new Date()
  const end = options.end ?? now
  const span = Math.max(1, options.days ?? 30)
  const start = options.start ?? addDays(end, -(span - 1))
  const thresholds = options.thresholds ?? DEFAULT_HEAT_THRESHOLDS

  // Sum minutes by day key across all tasks.
  const byDay = new Map<string, number>()
  for (const task of tasks) {
    for (const log of task.timeLogs ?? []) {
      const key = normalizeDayKey(log.date)
      if (!key) continue
      byDay.set(key, (byDay.get(key) ?? 0) + safeMinutes(log))
    }
  }

  const cells: HeatCell[] = []
  const cursor = startOfDay(start)
  const last = startOfDay(end)
  while (cursor.getTime() <= last.getTime()) {
    const date = dayKey(cursor)
    const minutes = byDay.get(date) ?? 0
    cells.push({ date, minutes, level: heatLevel(minutes, thresholds), worked: minutes > 0 })
    cursor.setDate(cursor.getDate() + 1)
  }
  return cells
}

/** Count of neglected (zero-work) days within a heatmap. */
export function neglectedDays(cells: HeatCell[]): number {
  return cells.filter((c) => !c.worked).length
}

// --- "To do next" selector -------------------------------------------------

export interface ToDoNextOptions {
  /** Reference "now" used for deadline urgency. Defaults to `new Date()`. */
  now?: Date
  /** Max number of tasks to return (default 5). */
  limit?: number
  /**
   * When true (default), a task is only eligible if all of its `dependencies`
   * that exist in the task tree are completed.
   */
  respectDependencies?: boolean
}

/**
 * Select the next actionable tasks from a set (an operation's task tree).
 * Eligible = not completed, not hidden, and (optionally) dependency-satisfied.
 * Ranked by: overdue/soonest deadline first, then higher importance, then
 * higher urgency, then older first. Returns up to `limit` tasks.
 */
export function selectToDoNext(tasks: Task[], options: ToDoNextOptions = {}): Task[] {
  const now = options.now ?? new Date()
  const limit = options.limit ?? 5
  const respectDeps = options.respectDependencies ?? true

  const completedIds = new Set(tasks.filter((t) => t.completed).map((t) => t.id))
  const eligible = tasks.filter((t) => {
    if (t.completed || t.hiddenFromTodo) return false
    if (!respectDeps) return true
    const deps = t.dependencies ?? []
    // Only block on dependencies we can see in this tree; unknown ids don't gate.
    return deps.every((d) => !tasks.some((x) => x.id === d) || completedIds.has(d))
  })

  return [...eligible].sort((a, b) => scoreTask(b, now) - scoreTask(a, now)).slice(0, limit)
}

/** Higher = more "do this next". Pure ranking score (deadline/importance/urgency/age). */
function scoreTask(task: Task, now: Date): number {
  let score = 0
  const deadline = toDate(task.deadline)
  if (deadline) {
    const daysOut = (deadline.getTime() - now.getTime()) / DAY_MS
    // Overdue (negative daysOut) and near deadlines score highest.
    score += Math.max(0, 100 - daysOut * 5)
  }
  score += (task.importance ?? 0) * 6
  score += (task.urgency ?? 0) * 4
  // Older tasks (smaller createdAt time) get a mild boost so they don't languish.
  const created = toDate(task.createdAt)
  if (created) {
    const ageDays = (now.getTime() - created.getTime()) / DAY_MS
    score += Math.min(20, Math.max(0, ageDays))
  }
  return score
}

// --- Date utils (local, dependency-free) -----------------------------------

const DAY_MS = 24 * 60 * 60 * 1000

function toDate(value: Date | string | undefined | null): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return isNaN(d.getTime()) ? null : d
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number): Date {
  const d = startOfDay(date)
  d.setDate(d.getDate() + days)
  return d
}

function dayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** Normalize a `TimeLogEntry.date` ("YYYY-MM-DD" or ISO) to a local day key. */
function normalizeDayKey(value: string | undefined | null): string | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (match) return `${match[1]}-${match[2]}-${match[3]}`
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : dayKey(d)
}
