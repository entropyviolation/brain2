/**
 * components/steps/step-tree-view.ts — Which rows a step tree draws
 *
 * Pure. Turns a step tree plus the view switches (folds, Hide locked, Hide
 * completed, Show next only, peek) into a flat list of rows: step rows, a dim
 * "+ N more" under a branch showing only its next step, and one quiet "+ step"
 * at the end of every open branch. The tree's data never changes here.
 *
 * The Tier filter (`tier`) keeps one level's view (`lib/step-tiers.ts`); a
 * step outside it with an in-view step inside shows greyed as its container.
 *
 * Locked comes only from `lib/prereqs.ts` (a step waiting on an open
 * prerequisite, its own or an ancestor's). An incomplete step is never locked.
 */
import type { Subtask } from "@/lib/types"
import { isStepAvailable } from "@/lib/prereqs"
import { pickStartStep } from "@/lib/next-step"
import { flattenSteps } from "@/lib/todo-steps"
import { stepsForTier } from "@/lib/step-tiers"
import type { StepTier } from "@/lib/types"

export type StepViewRow =
  | {
      kind: "step"
      step: Subtask
      depth: number
      parentId: string | null
      hasKids: boolean
      locked: boolean
      peeked: boolean
      /** Tier filter on: shown only as the container of an in-view step (Phase 10). */
      greyed?: boolean
    }
  | { kind: "more"; parentId: string; depth: number; count: number }
  | { kind: "add"; parentId: string | null; depth: number }

export interface StepViewOptions {
  /** Step ids whose children are folded away. */
  folded?: ReadonlySet<string>
  hideLocked?: boolean
  /**
   * Skip a step with `completed`. An open parent stays. A completed parent is
   * skipped with its subtree. Not counted in `hiddenBySwitches` (that line is
   * for waits, not for done work).
   */
  hideCompleted?: boolean
  nextOnly?: boolean
  /** Branches opened in full while Show next only is on. */
  openedNext?: ReadonlySet<string>
  /** Show what the switches hide, without turning them off. */
  peek?: boolean
  /** Tier filter (Phase 10): only that level's view, with greyed containers. */
  tier?: StepTier
  /** Locks from outside the tree (awaited events, other tasks; `lib/node-needs.ts`). */
  extraLock?: (step: Subtask) => boolean
}

export interface StepView {
  rows: StepViewRow[]
  /** Steps the switches keep off screen (0 when peeking shows them). */
  hidden: number
  /** Hidden by the switches, whether or not a peek is showing them. */
  hiddenBySwitches: number
}

/** True when an open step waits on an open prerequisite (`lib/prereqs.ts`). Done or merely incomplete is never locked. */
export function isStepLocked(steps: readonly Subtask[] | undefined, step: Subtask, extra?: (step: Subtask) => boolean): boolean {
  return !step.completed && (!isStepAvailable(steps, step.id) || !!extra?.(step))
}

/** Hide locked drops a locked step, and a branch whose children are all hidden for the same reason. */
export function hiddenByLock(steps: readonly Subtask[] | undefined, step: Subtask, extra?: (step: Subtask) => boolean): boolean {
  if (isStepLocked(steps, step, extra)) return true
  const kids = step.subtasks ?? []
  return kids.length > 0 && kids.every((kid) => hiddenByLock(steps, kid, extra))
}

/** Descendants Show next only may collapse. Completed steps drop out of the count when Hide completed is on, and a completed parent takes its subtree. */
function countableInside(list: readonly Subtask[] | undefined, hideCompleted: boolean): number {
  if (!hideCompleted) return flattenSteps(list).length
  let n = 0
  for (const step of list ?? []) {
    if (step.completed) continue
    n += 1 + countableInside(step.subtasks, true)
  }
  return n
}

/** The one step Show next only keeps under a branch: the Just Start pick inside it, else its first open leaf. */
export function nextStepInBranch(steps: readonly Subtask[] | undefined, branch: Subtask, extra?: (step: Subtask) => boolean): Subtask | undefined {
  const pick = pickStartStep({ subtasks: branch.subtasks })
  if (pick.kind === "step" && !isStepLocked(steps, pick.step, extra)) return pick.step
  return flattenSteps(branch.subtasks).find(
    (s) => !s.completed && (s.subtasks ?? []).every((k) => k.completed) && !isStepLocked(steps, s, extra),
  )
}

export function buildStepView(steps: readonly Subtask[] | undefined, options: StepViewOptions = {}): StepView {
  const all = steps ?? []
  const rows: StepViewRow[] = []
  let hiddenBySwitches = 0
  const folded = options.folded ?? new Set<string>()
  const openedNext = options.openedNext ?? new Set<string>()
  const tierView = options.tier ? stepsForTier(all, options.tier) : null

  // `counted`: an ancestor is already counted as hidden (we are inside a peek).
  const walk = (list: readonly Subtask[], depth: number, parentId: string | null, counted = false) => {
    for (const step of list) {
      if (options.hideCompleted && step.completed) continue
      let peeked = counted
      if (tierView && !counted && !tierView.ids.has(step.id) && !tierView.containers.has(step.id)) {
        hiddenBySwitches += 1 + flattenSteps(step.subtasks).length
        if (!options.peek) continue
        peeked = true
      }
      if (options.hideLocked && !peeked && hiddenByLock(all, step, options.extraLock)) {
        hiddenBySwitches += 1 + flattenSteps(step.subtasks).length
        if (!options.peek) continue
        peeked = true
      }
      const kids = step.subtasks ?? []
      const greyed = !!tierView?.containers.has(step.id)
      rows.push({ kind: "step", step, depth, parentId, hasKids: kids.length > 0, locked: isStepLocked(all, step, options.extraLock), peeked, ...(greyed ? { greyed } : {}) })
      if (kids.length === 0 || folded.has(step.id)) continue
      const inside = countableInside(kids, !!options.hideCompleted)
      if (options.nextOnly && inside > 1 && !openedNext.has(step.id)) {
        const next = nextStepInBranch(all, step, options.extraLock)
        const more = inside - (next ? 1 : 0)
        if (!peeked) hiddenBySwitches += more
        if (!options.peek) {
          if (next) {
            rows.push({ kind: "step", step: next, depth: depth + 1, parentId: step.id, hasKids: false, locked: false, peeked: false })
          }
          if (more > 0) rows.push({ kind: "more", parentId: step.id, depth: depth + 1, count: more })
          continue
        }
      }
      walk(kids, depth + 1, step.id, peeked)
      rows.push({ kind: "add", parentId: step.id, depth: depth + 1 })
    }
  }
  walk(all, 0, null)
  if (all.length > 0) rows.push({ kind: "add", parentId: null, depth: 0 })
  return { rows, hidden: options.peek ? 0 : hiddenBySwitches, hiddenBySwitches }
}
