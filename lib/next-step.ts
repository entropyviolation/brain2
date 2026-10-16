/**
 * lib/next-step.ts — What Just Start puts in front of you
 *
 * `pickStartStep` walks a task's whole step tree and returns the single step
 * to do next: the **lowest-level** open step (a leaf, or a parent whose
 * children are all done), whose prerequisites are met, that **has an
 * estimate**: first one that counts toward the lowest level not yet reached
 * (Phase 10, `lib/step-progress.ts`; a no-op without step tiers), then the
 * **lowest estimate**. Ties go to `isMolecular`, then tree order. `rankStartSteps` returns the top three in that same order, for the
 * Today's choices screen; its first is always `pickStartStep`'s. When
 * nothing qualifies it says why (no steps, all done, steps need estimates,
 * everything blocked, or the task itself is waiting on another task), so the
 * screen can fix that instead of guessing.
 *
 * Pure. The tree helpers here (`stepPath`, `setStepDependsOn`,
 * `setStepContext`, `addStepMinutes`, `finishStep`, `splitStep`,
 * `blockerCandidates`) return new arrays.
 */
import type { Subtask, Task } from "@/lib/types"
import { hasUnmetDependencies, type DepTask } from "@/lib/available-tasks"
import { addNestedStep } from "@/lib/todo-steps"
import { effectiveTierMap, tierRank } from "@/lib/step-tiers"
import { nextLevel } from "@/lib/step-progress"

export interface PlacedStep {
  step: Subtask
  /** Ancestors, outermost first. Empty for a top-level step. */
  path: Subtask[]
  /** Position in a depth-first walk, for stable ties. */
  order: number
}

export interface BlockedStep extends PlacedStep {
  /** Open steps this one (or an ancestor) is waiting on. */
  blockers: Subtask[]
}

export type StartPick =
  | { kind: "step"; step: Subtask; path: Subtask[]; minutes: number; ready: number }
  | { kind: "no-steps" }
  | { kind: "all-done" }
  | { kind: "needs-estimates"; leaves: PlacedStep[] }
  | { kind: "blocked"; leaves: BlockedStep[] }
  | { kind: "task-blocked"; blockerIds: string[] }

export interface PickOptions {
  /** Other tasks, to check `task.dependencies`. Omit to ignore task-level prerequisites. */
  allTasks?: readonly DepTask[]
  /** Step ids passed over this sitting. Ignored once every ready step has been skipped. */
  skip?: readonly string[]
  /** Pick even if the task's own prerequisites are open. */
  ignoreTaskDependencies?: boolean
}

function ownMinutes(step: Subtask): number {
  const m = step.estimatedDuration
  return typeof m === "number" && Number.isFinite(m) && m > 0 ? m : 0
}

/** Every step with its ancestors, depth first. */
export function placeSteps(steps: readonly Subtask[] | undefined): PlacedStep[] {
  const out: PlacedStep[] = []
  const walk = (list: readonly Subtask[], path: Subtask[]) => {
    for (const step of list) {
      out.push({ step, path, order: out.length })
      if (step.subtasks?.length) walk(step.subtasks, [...path, step])
    }
  }
  walk(steps ?? [], [])
  return out
}

/** Lowest-level open steps: no children, or every child already done. */
function isOpenLeaf(step: Subtask): boolean {
  if (step.completed) return false
  const kids = step.subtasks ?? []
  return kids.length === 0 || kids.every((kid) => kid.completed)
}

/** Open steps a step is waiting on, its own `dependsOn` and every ancestor's. */
export function openBlockers(placed: PlacedStep, byId: Map<string, Subtask>): Subtask[] {
  const ids = new Set<string>()
  for (const owner of [...placed.path, placed.step]) {
    for (const id of owner.dependsOn ?? []) ids.add(id)
  }
  const blockers: Subtask[] = []
  for (const id of ids) {
    const dep = byId.get(id)
    if (dep && !dep.completed) blockers.push(dep)
  }
  return blockers
}

/**
 * Level first (Phase 10): 0 for a step that counts toward the lowest level not
 * yet reached, else 1. Every step is 0 on a task without step tiers.
 */
function levelKeyFor(steps: readonly Subtask[] | undefined): (p: PlacedStep) => number {
  const target = nextLevel({ subtasks: steps ? [...steps] : [] })
  if (!target) return () => 0
  const tiers = effectiveTierMap(steps)
  const cap = tierRank(target)
  return (p) => (tierRank(tiers.get(p.step.id) ?? "goal") <= cap ? 0 : 1)
}

/** The one Just Start order: lowest level not yet reached, lowest estimate, then atomic, then tree order. */
function startOrderFor(steps: readonly Subtask[] | undefined): (a: PlacedStep, b: PlacedStep) => number {
  const level = levelKeyFor(steps)
  return (a, b) => level(a) - level(b) || startOrder(a, b)
}

function startOrder(a: PlacedStep, b: PlacedStep): number {
  return (
    ownMinutes(a.step) - ownMinutes(b.step) ||
    Number(!!b.step.isMolecular) - Number(!!a.step.isMolecular) ||
    a.order - b.order
  )
}

export interface RankedStep extends PlacedStep {
  minutes: number
}

/**
 * The top `n` ready steps in `pickStartStep`'s order (Today's choices).
 * The first is always `pickStartStep`'s step; skipped steps go to the back.
 * Empty when `pickStartStep` returns no step.
 */
export function rankStartSteps(
  task: Pick<Task, "subtasks" | "dependencies">,
  n = 3,
  options: PickOptions = {},
): RankedStep[] {
  const pick = pickStartStep(task, options)
  if (pick.kind !== "step") return []
  const placed = placeSteps(task.subtasks)
  const byId = new Map(placed.map((p) => [p.step.id, p.step]))
  const skip = new Set(options.skip ?? [])
  const order = startOrderFor(task.subtasks)
  const ready = placed
    .filter((p) => isOpenLeaf(p.step) && ownMinutes(p.step) > 0 && openBlockers(p, byId).length === 0)
    .sort((a, b) => Number(skip.has(a.step.id)) - Number(skip.has(b.step.id)) || order(a, b))
  const first = ready.find((p) => p.step.id === pick.step.id)!
  return [first, ...ready.filter((p) => p !== first)]
    .slice(0, Math.max(1, n))
    .map((p) => ({ ...p, minutes: ownMinutes(p.step) }))
}

export function pickStartStep(
  task: Pick<Task, "subtasks" | "dependencies">,
  options: PickOptions = {},
): StartPick {
  if (!options.ignoreTaskDependencies && options.allTasks && hasUnmetDependencies(task, options.allTasks)) {
    const blockerIds = (task.dependencies ?? []).filter((id) => {
      const dep = options.allTasks!.find((t) => t.id === id)
      return dep && hasUnmetDependencies({ dependencies: [id] }, options.allTasks!)
    })
    return { kind: "task-blocked", blockerIds }
  }

  const placed = placeSteps(task.subtasks)
  if (placed.length === 0) return { kind: "no-steps" }

  const byId = new Map(placed.map((p) => [p.step.id, p.step]))
  const leaves = placed.filter((p) => isOpenLeaf(p.step))
  if (leaves.length === 0) return { kind: "all-done" }

  const unblocked: PlacedStep[] = []
  const blocked: BlockedStep[] = []
  for (const leaf of leaves) {
    const blockers = openBlockers(leaf, byId)
    if (blockers.length) blocked.push({ ...leaf, blockers })
    else unblocked.push(leaf)
  }

  const ready = unblocked.filter((p) => ownMinutes(p.step) > 0)
  if (ready.length > 0) {
    const skip = new Set(options.skip ?? [])
    const fresh = ready.filter((p) => !skip.has(p.step.id))
    const pool = fresh.length ? fresh : ready
    const best = [...pool].sort(startOrderFor(task.subtasks))[0]
    return { kind: "step", step: best.step, path: best.path, minutes: ownMinutes(best.step), ready: ready.length }
  }

  const unestimated = unblocked.filter((p) => ownMinutes(p.step) === 0)
  if (unestimated.length) return { kind: "needs-estimates", leaves: unestimated }
  return { kind: "blocked", leaves: blocked }
}

/** Ancestors of a step, outermost first, or `null` when the id is not in the tree. */
export function stepPath(steps: readonly Subtask[] | undefined, id: string): Subtask[] | null {
  const hit = placeSteps(steps).find((p) => p.step.id === id)
  return hit ? hit.path : null
}

/** A placed step by id. */
export function findPlacedStep(steps: readonly Subtask[] | undefined, id: string): PlacedStep | undefined {
  return placeSteps(steps).find((p) => p.step.id === id)
}

function mapTree(steps: readonly Subtask[], visit: (step: Subtask) => Subtask): Subtask[] {
  return steps.map((step) => {
    const kids = step.subtasks?.length ? mapTree(step.subtasks, visit) : step.subtasks
    const base = kids === step.subtasks ? step : { ...step, subtasks: kids }
    return visit(base)
  })
}

/** Replace a step's prerequisites. Empty clears the field. */
export function setStepDependsOn(steps: readonly Subtask[] | undefined, id: string, dependsOn: string[]): Subtask[] {
  const unique = [...new Set(dependsOn.filter((dep) => dep && dep !== id))]
  return mapTree(steps ?? [], (step) => {
    if (step.id !== id) return step
    const next = { ...step }
    if (unique.length) next.dependsOn = unique
    else delete next.dependsOn
    return next
  })
}

/** Ids that `id` depends on, directly or through other steps (and its ancestors). */
function dependencyClosure(placed: PlacedStep[], id: string): Set<string> {
  const byId = new Map(placed.map((p) => [p.step.id, p]))
  const seen = new Set<string>()
  const stack = [id]
  while (stack.length) {
    const cur = byId.get(stack.pop()!)
    if (!cur) continue
    for (const owner of [...cur.path, cur.step]) {
      for (const dep of owner.dependsOn ?? []) {
        if (!seen.has(dep)) {
          seen.add(dep)
          stack.push(dep)
        }
      }
    }
  }
  return seen
}

/**
 * Open steps that `id` could be made to wait on. Leaves out the step itself,
 * its ancestors and descendants, and anything that already waits on it (that
 * would close a loop).
 */
export function blockerCandidates(steps: readonly Subtask[] | undefined, id: string): PlacedStep[] {
  const placed = placeSteps(steps)
  const self = placed.find((p) => p.step.id === id)
  if (!self) return []
  const ancestors = new Set(self.path.map((s) => s.id))
  const descendants = new Set(placeSteps(self.step.subtasks).map((p) => p.step.id))
  return placed.filter((p) => {
    const sid = p.step.id
    if (sid === id || ancestors.has(sid) || descendants.has(sid) || p.step.completed) return false
    return !dependencyClosure(placed, sid).has(id)
  })
}

/**
 * Tick a step done with the minutes it took. Ancestors whose children are now
 * all done are ticked as well, so a finished branch reads as finished.
 */
export function finishStep(
  steps: readonly Subtask[] | undefined,
  id: string,
  actualMinutes: number | undefined,
  now: Date = new Date(),
): Subtask[] {
  const minutes = actualMinutes && actualMinutes > 0 ? Math.round(actualMinutes) : undefined
  const ticked = mapTree(steps ?? [], (step) =>
    step.id === id
      ? { ...step, completed: true, completedAt: now, ...(minutes ? { actualDuration: minutes } : {}) }
      : step,
  )
  const path = stepPath(ticked, id) ?? []
  const ancestorIds = new Set(path.map((s) => s.id))
  return mapTree(ticked, (step) =>
    ancestorIds.has(step.id) && !step.completed && (step.subtasks ?? []).every((kid) => kid.completed)
      ? { ...step, completed: true, completedAt: now }
      : step,
  )
}

/** Set a step's `context` note ("left it here"). Blank clears it. */
export function setStepContext(steps: readonly Subtask[] | undefined, id: string, context: string): Subtask[] {
  const words = context.trim()
  return mapTree(steps ?? [], (step) => {
    if (step.id !== id) return step
    const next = { ...step }
    if (words) next.context = words
    else delete next.context
    return next
  })
}

/** Add minutes to a step's `actualDuration` and leave it open (a closed time box). */
export function addStepMinutes(steps: readonly Subtask[] | undefined, id: string, minutes: number): Subtask[] {
  const add = Math.round(minutes)
  if (!(add > 0)) return [...(steps ?? [])]
  return mapTree(steps ?? [], (step) =>
    step.id === id ? { ...step, actualDuration: (step.actualDuration ?? 0) + add } : step,
  )
}

/** Split a step into smaller ones nested under it. Blank names are dropped. */
export function splitStep(
  steps: readonly Subtask[] | undefined,
  id: string,
  parts: { description: string; estimatedDuration?: number }[],
): Subtask[] {
  let next = [...(steps ?? [])]
  for (const part of parts) {
    if (!part.description.trim()) continue
    next = addNestedStep(next, id, part)
  }
  return next
}

/** Open steps and minutes left, over the lowest-level steps only (parents are their children's sum). */
export function startProgress(steps: readonly Subtask[] | undefined): {
  done: number
  total: number
  minutesLeft: number
  minutesTotal: number
} {
  const leaves = placeSteps(steps).filter((p) => !(p.step.subtasks?.length))
  let done = 0
  let minutesLeft = 0
  let minutesTotal = 0
  for (const { step } of leaves) {
    const m = ownMinutes(step)
    minutesTotal += m
    if (step.completed) done += 1
    else minutesLeft += m
  }
  return { done, total: leaves.length, minutesLeft, minutesTotal }
}
