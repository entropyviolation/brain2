/**
 * lib/estimate-pace.ts — Your own pace (Phase 6, FN-2)
 *
 * How long things really take you against what you typed: the median of
 * actual ÷ estimate, overall or for one pen, from finished steps and from
 * closed session lines. Fewer than three samples → 1. An override set in
 * To Do → Pace wins. Pure; the ghost figure and the session fit gauge read it.
 * Nothing here ever writes an estimate.
 */
import { allLines, lineMinutes, type SessionPlan } from "@/lib/session-plan"
import type { Subtask, Task } from "@/lib/types"

export { sessionPace } from "@/lib/session-plan"

/** Below this many samples a pace reads as 1. */
export const PACE_MIN_SAMPLES = 3
/** Ghost shows at or above this pace. */
export const PACE_GHOST_AT = 1.2
const PACE_FLOOR = 0.5
const PACE_CEIL = 4

export type PaceScope = { kind: "overall" } | { kind: "pen"; penId: string } | { kind: "list"; listId: string }

export interface PaceSample {
  ratio: number
  penIds: string[]
  listIds: string[]
}

/** `"overall"`, `"pen:<id>"`, `"list:<id>"` — the key an override is stored under. */
export function paceKey(scope: PaceScope): string {
  return scope.kind === "overall" ? "overall" : scope.kind === "pen" ? `pen:${scope.penId}` : `list:${scope.listId}`
}

type PaceTask = {
  id: string
  subtasks?: Subtask[]
  penLinks?: { penId: string }[]
}

function finishedSteps(steps: readonly Subtask[] | undefined, out: Subtask[] = []): Subtask[] {
  for (const step of steps ?? []) {
    if (step.completed && step.estimatedDuration && step.estimatedDuration > 0 && step.actualDuration && step.actualDuration > 0) {
      out.push(step)
    }
    finishedSteps(step.subtasks, out)
  }
  return out
}

/**
 * Every actual ÷ estimate pair: finished steps with both numbers, and finished
 * session lines with both. `listIdsOf` tags a sample with its task's lists.
 */
export function paceSamples(
  tasks: readonly PaceTask[],
  history: readonly SessionPlan[] = [],
  listIdsOf: (taskId: string) => string[] = () => [],
): PaceSample[] {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const tag = (taskId: string) => ({
    penIds: (byId.get(taskId)?.penLinks ?? []).map((l) => l.penId),
    listIds: listIdsOf(taskId),
  })
  const samples: PaceSample[] = []
  for (const task of tasks) {
    for (const step of finishedSteps(task.subtasks)) {
      samples.push({ ratio: step.actualDuration! / step.estimatedDuration!, ...tag(task.id) })
    }
  }
  for (const plan of history) {
    for (const { line } of allLines(plan)) {
      if (line.doneAt && line.estMin && line.estMin > 0 && line.actualSec && line.actualSec > 0) {
        samples.push({ ratio: line.actualSec / 60 / line.estMin, ...tag(line.taskId) })
      }
    }
  }
  return samples
}

function inScope(sample: PaceSample, scope: PaceScope): boolean {
  if (scope.kind === "overall") return true
  if (scope.kind === "pen") return sample.penIds.includes(scope.penId)
  return sample.listIds.includes(scope.listId)
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** How many samples a scope has. */
export function paceSampleCount(samples: readonly PaceSample[], scope: PaceScope): number {
  return samples.filter((s) => inScope(s, scope)).length
}

/**
 * Median actual ÷ estimate for a scope, clamped to 0.5–4. Fewer than three
 * samples → 1. A positive override for the scope's key wins.
 */
export function paceFor(
  samples: readonly PaceSample[],
  scope: PaceScope = { kind: "overall" },
  overrides: Record<string, number> = {},
): number {
  const set = overrides[paceKey(scope)]
  if (typeof set === "number" && Number.isFinite(set) && set > 0) return set
  const ratios = samples.filter((s) => inScope(s, scope)).map((s) => s.ratio)
  if (ratios.length < PACE_MIN_SAMPLES) return 1
  return Math.min(PACE_CEIL, Math.max(PACE_FLOOR, median(ratios)))
}

/**
 * The pace for one task: its first linked pen with enough samples (or an
 * override), else overall.
 */
export function paceForTask(
  task: Pick<PaceTask, "penLinks"> | undefined,
  samples: readonly PaceSample[],
  overrides: Record<string, number> = {},
): number {
  for (const { penId } of task?.penLinks ?? []) {
    const scope: PaceScope = { kind: "pen", penId }
    if (overrides[paceKey(scope)] > 0 || paceSampleCount(samples, scope) >= PACE_MIN_SAMPLES) {
      return paceFor(samples, scope, overrides)
    }
  }
  return paceFor(samples, { kind: "overall" }, overrides)
}

/** The ghost's words, or null when the pace is under 1.2. */
export function paceGhostLabel(pace: number): string | null {
  if (!(pace >= PACE_GHOST_AT)) return null
  return `usually ×${pace.toFixed(1)} for you`
}

/**
 * Padded for you (FN-2, Phase 4 fit gauge): the pace across a session's open
 * lines, each line weighted by its minutes and read at its own task's pace
 * (`paceForTask`). Pass it as `sessionFit`'s `pace` when the toggle is on, and
 * 1 when it is off. 1 with no minutes planned.
 */
export function sessionPaceFactor(
  plan: SessionPlan,
  tasks: readonly Task[],
  samples: readonly PaceSample[],
  overrides: Record<string, number> = {},
): number {
  let minutes = 0
  let weighted = 0
  for (const { line } of allLines(plan)) {
    const m = lineMinutes(line, tasks)
    if (m <= 0) continue
    const task = tasks.find((t) => t.id === line.taskId)
    minutes += m
    weighted += m * paceForTask(task, samples, overrides)
  }
  return minutes > 0 ? weighted / minutes : 1
}

/** The fit gauge's words when padded: "padded for you ×1.6", or null at ×1. */
export function paddedLabel(pace: number): string | null {
  if (!(pace > 0) || Math.abs(pace - 1) < 0.05) return null
  return `padded for you ×${pace.toFixed(1)}`
}
