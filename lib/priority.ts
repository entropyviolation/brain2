/**
 * lib/priority.ts — Transparent, entropy-aware priority formula (Brain2 #42/#46)
 *
 * A pure, deterministic priority score for a Task, combining four signals into a
 * single rank you can re-weight and inspect. The formula is intentionally simple
 * and explainable — `priorityBreakdown` returns each component's contribution so
 * the UI can show *why* a task ranks where it does.
 *
 * Components (each normalized to 0..1 before weighting):
 *   - urgency      (1-5): higher is more urgent → (u-1)/4
 *   - importance   (1-5): higher matters more  → (i-1)/4
 *   - cognitiveLoad(1-3): LOWER load ranks higher so quick wins bubble up when
 *                         you want momentum → (3-load)/2  (load 1 → 1, load 3 → 0)
 *   - entropy      (0-1): HIGHER entropy ranks higher so vague/unclear tasks
 *                         surface for clarification rather than rotting silently.
 *
 * Score = wU·nUrgency + wI·nImportance + wC·nLoadInv + wE·entropy.
 * With default (all-1) weights the score lands in 0..4; higher = do sooner.
 * Owner: Worker A.
 */
import type { PriorityWeights, Task } from "@/lib/types"

/** Neutral starting weights — every signal counts equally. */
export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  urgency: 1,
  importance: 1,
  cognitiveLoad: 1,
  entropy: 1,
}

/** Defaults applied when a task omits a signal (mirrors createNextActionItem). */
const FIELD_DEFAULTS = {
  urgency: 3,
  importance: 3,
  cognitiveLoad: 2,
  entropy: 0.5,
} as const

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)

type PriorityFields = Pick<Task, "urgency" | "importance" | "cognitiveLoad" | "entropy">

/** Normalize each raw task signal to a comparable 0..1 scale. */
export function normalizePriorityInputs(task: PriorityFields): {
  urgency: number
  importance: number
  cognitiveLoad: number
  entropy: number
} {
  const urgency = task.urgency ?? FIELD_DEFAULTS.urgency
  const importance = task.importance ?? FIELD_DEFAULTS.importance
  const cognitiveLoad = task.cognitiveLoad ?? FIELD_DEFAULTS.cognitiveLoad
  const entropy = task.entropy ?? FIELD_DEFAULTS.entropy
  return {
    urgency: clamp01((urgency - 1) / 4),
    importance: clamp01((importance - 1) / 4),
    // Lower cognitive load → higher contribution (quick-win bias).
    cognitiveLoad: clamp01((3 - cognitiveLoad) / 2),
    entropy: clamp01(entropy),
  }
}

export interface PriorityBreakdown {
  urgency: number
  importance: number
  cognitiveLoad: number
  entropy: number
  total: number
}

/** Per-component weighted contributions plus the total (for the formula UI). */
export function priorityBreakdown(
  task: PriorityFields,
  weights: PriorityWeights = DEFAULT_PRIORITY_WEIGHTS,
): PriorityBreakdown {
  const n = normalizePriorityInputs(task)
  const urgency = n.urgency * weights.urgency
  const importance = n.importance * weights.importance
  const cognitiveLoad = n.cognitiveLoad * weights.cognitiveLoad
  const entropy = n.entropy * weights.entropy
  return {
    urgency,
    importance,
    cognitiveLoad,
    entropy,
    total: urgency + importance + cognitiveLoad + entropy,
  }
}

/**
 * The single priority score. Deterministic; higher means "do sooner".
 * Pure — depends only on the task's signals and the supplied weights.
 */
export function computePriorityScore(
  task: PriorityFields,
  weights: PriorityWeights = DEFAULT_PRIORITY_WEIGHTS,
): number {
  return priorityBreakdown(task, weights).total
}

/** Sort a copy of `tasks` by descending priority (stable for ties). */
export function sortByPriority<T extends PriorityFields>(
  tasks: T[],
  weights: PriorityWeights = DEFAULT_PRIORITY_WEIGHTS,
): T[] {
  return tasks
    .map((task, index) => ({ task, index, score: computePriorityScore(task, weights) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((x) => x.task)
}
