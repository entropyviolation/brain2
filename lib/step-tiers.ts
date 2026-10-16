/**
 * lib/step-tiers.ts — Bare minimum, Goal and Exceptional inside a task (Phase 10)
 *
 * A step's `tier` says which level it belongs to. Missing inherits the nearest
 * ancestor's; a top-level step with none is Goal (Decision 8). Views are
 * cumulative: Goal holds Bare minimum, Exceptional holds all. A step outside
 * a view that has a step inside it shows greyed as its **container**; it is
 * not counted as that level's step.
 *
 * Pure. The editing helpers (`setStepTier`, `cycleStepTier`, `toggleStepSpark`)
 * return new arrays.
 */
import type { StepTier, Subtask, Task } from "@/lib/types"

export type { StepTier }

/** Lowest first: the order levels climb in. */
export const STEP_TIERS: readonly StepTier[] = ["min", "goal", "exceptional"]

export const STEP_TIER_LABEL: Record<StepTier, string> = {
  min: "Bare minimum",
  goal: "Goal",
  exceptional: "Exceptional",
}

export const STEP_TIER_SHORT: Record<StepTier, string> = { min: "B", goal: "G", exceptional: "E" }

export function tierRank(tier: StepTier): number {
  return STEP_TIERS.indexOf(tier)
}

export function isStepTier(value: unknown): value is StepTier {
  return value === "min" || value === "goal" || value === "exceptional"
}

type StepsOf = Pick<Task, "subtasks"> | readonly Subtask[] | undefined

function stepsOf(source: StepsOf): readonly Subtask[] {
  if (!source) return []
  return Array.isArray(source) ? source : ((source as Pick<Task, "subtasks">).subtasks ?? [])
}

/** Every step's effective tier, keyed by id. */
export function effectiveTierMap(source: StepsOf): Map<string, StepTier> {
  const out = new Map<string, StepTier>()
  const walk = (list: readonly Subtask[], inherited: StepTier) => {
    for (const step of list) {
      const tier = isStepTier(step.tier) ? step.tier : inherited
      out.set(step.id, tier)
      if (step.subtasks?.length) walk(step.subtasks, tier)
    }
  }
  walk(stepsOf(source), "goal")
  return out
}

/** The tier a step counts at, or `undefined` when the id is not in the tree. */
export function effectiveTier(source: StepsOf, stepId: string): StepTier | undefined {
  return effectiveTierMap(source).get(stepId)
}

/** True when any step names a tier. Without one, everything is Goal. */
export function hasStepTiers(source: StepsOf): boolean {
  const walk = (list: readonly Subtask[]): boolean =>
    list.some((s) => isStepTier(s.tier) || (!!s.subtasks?.length && walk(s.subtasks)))
  return walk(stepsOf(source))
}

export interface TierView {
  tier: StepTier
  /** Steps that count at this level (their tier is this one or lower). */
  ids: Set<string>
  /** Greyed containers: outside the view, with a step inside it. */
  containers: Set<string>
}

/** One level's view, cumulative, with greyed containers. */
export function stepsForTier(source: StepsOf, tier: StepTier): TierView {
  const tiers = effectiveTierMap(source)
  const ids = new Set<string>()
  const containers = new Set<string>()
  const cap = tierRank(tier)
  const walk = (list: readonly Subtask[]): boolean => {
    let any = false
    for (const step of list) {
      const inner = step.subtasks?.length ? walk(step.subtasks) : false
      if (tierRank(tiers.get(step.id) ?? "goal") <= cap) ids.add(step.id)
      else if (inner) containers.add(step.id)
      if (ids.has(step.id) || inner) any = true
    }
    return any
  }
  walk(stepsOf(source))
  return { tier, ids, containers }
}

/** Steps whose effective tier is exactly this one. */
export function tierBand(source: StepsOf, tier: StepTier): Set<string> {
  const out = new Set<string>()
  for (const [id, t] of effectiveTierMap(source)) if (t === tier) out.add(id)
  return out
}

function mapTree(steps: readonly Subtask[], visit: (step: Subtask) => Subtask): Subtask[] {
  return steps.map((step) => {
    const kids = step.subtasks?.length ? mapTree(step.subtasks, visit) : step.subtasks
    return visit(kids === step.subtasks ? step : { ...step, subtasks: kids })
  })
}

/** Set a step's own tier. `undefined` clears it (inherit). */
export function setStepTier(steps: readonly Subtask[] | undefined, id: string, tier: StepTier | undefined): Subtask[] {
  return mapTree(steps ?? [], (step) => {
    if (step.id !== id) return step
    const next = { ...step }
    if (tier) next.tier = tier
    else delete next.tier
    return next
  })
}

/** The tag's click: B → G → E → inherit → B. */
export function nextTierInCycle(tier: StepTier | undefined): StepTier | undefined {
  if (!tier) return "min"
  if (tier === "min") return "goal"
  if (tier === "goal") return "exceptional"
  return undefined
}

export function cycleStepTier(steps: readonly Subtask[] | undefined, id: string, current: StepTier | undefined): Subtask[] {
  return setStepTier(steps, id, nextTierInCycle(current))
}

/** Set or clear the spark mark (UI-7). It changes nothing but sort order. */
export function toggleStepSpark(steps: readonly Subtask[] | undefined, id: string, now: Date = new Date()): Subtask[] {
  return mapTree(steps ?? [], (step) => {
    if (step.id !== id) return step
    const next = { ...step }
    if (next.sparkedAt) delete next.sparkedAt
    else next.sparkedAt = now.toISOString()
    return next
  })
}
