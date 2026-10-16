/**
 * lib/step-progress.ts — The one progress rule over a step tree (Phase 10, R14–R16)
 *
 * Weighted percent: a ticked step is 100%; an unticked parent is the plain
 * average of its children; an unticked leaf is 0%. A task is 100% when done,
 * else the average of its top-level steps. Counts (`3/6`) stay counts
 * (`internalStepProgress` in `lib/todo-steps.ts`); only the percent is weighted.
 *
 * Levels (`lib/step-tiers.ts`): a step is **done to level T** when it is
 * ticked, or it has children in T's view and all of them are done to T. Levels
 * climb in order. A level is **empty** when no step's own tier is that one
 * (Exceptional needs an Exceptional step). **An empty level is never
 * reached** and its percent is `null` (read `—`), never 0%.
 *
 * Pure. Percents are fractions 0–1; `formatPercent` rounds for display.
 */
import type { Subtask, Task } from "@/lib/types"
import { STEP_TIERS, effectiveTierMap, stepsForTier, type StepTier, type TierView } from "@/lib/step-tiers"

/** Weighted percent of one step (0–1). */
export function stepPercent(step: Subtask): number {
  if (step.completed) return 1
  const kids = step.subtasks ?? []
  if (kids.length === 0) return 0
  return kids.reduce((sum, kid) => sum + stepPercent(kid), 0) / kids.length
}

/** Average of the top-level steps, or `null` with no steps. */
export function weightedPercent(steps: readonly Subtask[] | undefined): number | null {
  const list = steps ?? []
  if (list.length === 0) return null
  return list.reduce((sum, step) => sum + stepPercent(step), 0) / list.length
}

/** A task's percent: 1 when done, else its steps'. `null` with no steps (read the status instead). */
export function taskPercent(task: Pick<Task, "subtasks">, done = false): number | null {
  if (done) return 1
  return weightedPercent(task.subtasks)
}

function inView(view: TierView, step: Subtask): boolean {
  return view.ids.has(step.id) || view.containers.has(step.id)
}

/** A step's percent over one level's view, or `null` when the step is outside it. */
export function viewStepPercent(step: Subtask, view: TierView): number | null {
  if (!inView(view, step)) return null
  if (step.completed) return 1
  const kids = (step.subtasks ?? []).filter((kid) => inView(view, kid))
  if (kids.length === 0) return 0
  return kids.reduce((sum, kid) => sum + (viewStepPercent(kid, view) ?? 0), 0) / kids.length
}

function viewListPercent(steps: readonly Subtask[], view: TierView): number | null {
  const list = steps.filter((s) => inView(view, s))
  if (list.length === 0) return null
  return list.reduce((sum, step) => sum + (viewStepPercent(step, view) ?? 0), 0) / list.length
}

/** Done to the view's level: ticked, or every in-view child done to it. */
export function doneToView(step: Subtask, view: TierView): boolean {
  if (step.completed) return true
  const kids = (step.subtasks ?? []).filter((kid) => inView(view, kid))
  return kids.length > 0 && kids.every((kid) => doneToView(kid, view))
}

export type LevelReached = "none" | StepTier

/**
 * The highest level reached. Empty levels are skipped (never reached); the
 * first non-empty level not reached stops the climb. `done` (the task is
 * ticked) reaches every non-empty level.
 */
export function levelReached(task: Pick<Task, "subtasks">, done = false): LevelReached {
  const steps = task.subtasks ?? []
  const bands = new Set(effectiveTierMap(steps).values())
  let reached: LevelReached = "none"
  for (const tier of STEP_TIERS) {
    const view = stepsForTier(steps, tier)
    if (!bands.has(tier)) continue
    const top = steps.filter((s) => inView(view, s))
    if (!done && !top.every((s) => doneToView(s, view))) break
    reached = tier
  }
  return reached
}

/** The lowest non-empty level not yet reached, or `null` when none is left. */
export function nextLevel(task: Pick<Task, "subtasks">): StepTier | null {
  const steps = task.subtasks ?? []
  const bands = new Set(effectiveTierMap(steps).values())
  for (const tier of STEP_TIERS) {
    const view = stepsForTier(steps, tier)
    if (!bands.has(tier)) continue
    if (!steps.filter((s) => inView(view, s)).every((s) => doneToView(s, view))) return tier
  }
  return null
}

export type LevelPercents = Record<StepTier, number | null>

function findStep(steps: readonly Subtask[], id: string): Subtask | undefined {
  for (const step of steps) {
    if (step.id === id) return step
    const hit = step.subtasks?.length ? findStep(step.subtasks, id) : undefined
    if (hit) return hit
  }
  return undefined
}

/**
 * B %, G %, E % for a task, or for one step's subtree with `stepId`. Each is
 * the weighted percent over that level's view; an empty level is `null`.
 */
export function levelProgress(task: Pick<Task, "subtasks">, stepId?: string): LevelPercents {
  const steps = task.subtasks ?? []
  const bands = new Set(effectiveTierMap(steps).values())
  const out = { min: null, goal: null, exceptional: null } as LevelPercents
  const step = stepId ? findStep(steps, stepId) : undefined
  if (stepId && !step) return out
  for (const tier of STEP_TIERS) {
    const view = stepsForTier(steps, tier)
    if (!bands.has(tier)) continue
    if (step) {
      // A step's own level reads only when something in its subtree counts there.
      const anyInside = view.ids.has(step.id) || (step.subtasks ?? []).some((kid) => inView(view, kid))
      out[tier] = anyInside ? viewStepPercent(step, view) : null
    } else {
      out[tier] = viewListPercent(steps, view)
    }
  }
  return out
}

/** Counting minutes for one level: in-view estimates, a container counts only its in-view children. */
export function tierMinutes(steps: readonly Subtask[] | undefined, tier: StepTier): number {
  const view = stepsForTier(steps, tier)
  const visit = (step: Subtask): number => {
    if (!inView(view, step)) return 0
    const inner = (step.subtasks ?? []).reduce((sum, kid) => sum + visit(kid), 0)
    if (view.containers.has(step.id)) return inner
    const m = step.estimatedDuration
    const own = typeof m === "number" && Number.isFinite(m) && m > 0 ? m : 0
    return Math.max(own, inner)
  }
  return (steps ?? []).reduce((sum, step) => sum + visit(step), 0)
}

/** "31%", or "—" for an empty level. */
export function formatPercent(p: number | null): string {
  return p == null ? "—" : `${Math.round(p * 100)}%`
}
