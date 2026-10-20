/**
 * lib/tree-math.ts — Two honest completion numbers over a step tree (task card header)
 *
 * End nodes are leaves. A ticked parent counts all its leaves done.
 *
 *   ρ (raw)   = Σ dᵢ / Σ Lᵢ          every end node weighs the same
 *   σ (split) = (1/n) Σ dᵢ / Lᵢ      every top-level part weighs the same
 *
 * where part i has Lᵢ end nodes, dᵢ of them done. Δ = σ − ρ is positive when
 * the small parts are further along than the big ones.
 *
 * Levels: B / G / E at any root read the same two numbers over only the
 * children whose effective tier is exactly that level. An empty level is `null`.
 *
 * Pure. Fractions 0–1.
 */
import type { StepTier, Subtask } from "@/lib/types"
import { STEP_TIERS, effectiveTierMap } from "@/lib/step-tiers"

export interface Part {
  id: string
  name: string
  leaves: number
  done: number
  tier: StepTier
}

export interface SplitStats {
  parts: Part[]
  leaves: number
  done: number
  raw: number | null
  split: number | null
}

/** End nodes under a step (itself when it has no children), and how many are done. */
export function leafTally(step: Subtask, parentDone = false): { leaves: number; done: number } {
  const done = parentDone || !!step.completed
  const kids = step.subtasks ?? []
  if (kids.length === 0) return { leaves: 1, done: done ? 1 : 0 }
  return kids.reduce(
    (acc, kid) => {
      const t = leafTally(kid, done)
      return { leaves: acc.leaves + t.leaves, done: acc.done + t.done }
    },
    { leaves: 0, done: 0 },
  )
}

export function splitStats(list: readonly Subtask[], tiers: Map<string, StepTier>): SplitStats {
  const parts = list.map((s) => ({ id: s.id, name: s.description, tier: tiers.get(s.id) ?? "goal", ...leafTally(s) }))
  const leaves = parts.reduce((n, p) => n + p.leaves, 0)
  const done = parts.reduce((n, p) => n + p.done, 0)
  return {
    parts,
    leaves,
    done,
    raw: leaves ? done / leaves : null,
    split: parts.length ? parts.reduce((n, p) => n + p.done / p.leaves, 0) / parts.length : null,
  }
}

export type TierSplit = Record<StepTier, SplitStats | null>

/** The children of a root (the task with no id), split by their exact tier. */
export function tierSplit(steps: readonly Subtask[], tiers: Map<string, StepTier> = effectiveTierMap([...steps]), root?: Subtask): TierSplit {
  const kids = root ? root.subtasks ?? [] : steps
  const out = { min: null, goal: null, exceptional: null } as TierSplit
  for (const t of STEP_TIERS) {
    const mine = kids.filter((k) => tiers.get(k.id) === t)
    if (mine.length) out[t] = splitStats(mine, tiers)
  }
  return out
}

/** Deepest level of nesting (a flat list is 1). */
export function treeDepth(list: readonly Subtask[] | undefined): number {
  return (list ?? []).reduce((d, s) => Math.max(d, 1 + treeDepth(s.subtasks)), 0)
}
