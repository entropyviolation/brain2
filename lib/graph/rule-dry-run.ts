/**
 * lib/graph/rule-dry-run.ts — What one rule would derive vault-wide
 * (LINKS_REDESIGN §9.1, L3.5). The one vault pass the library allows, run on
 * demand. Cached by tasks array identity plus the rule's body.
 */
import { deriveAround } from "@/lib/graph/ego-reason"
import { linkIndexOf } from "@/lib/graph/link-index"
import type { RelationLattice } from "@/lib/graph/relation-lattice"
import type { RelationRule } from "@/lib/graph/relation-rules"
import type { ItemRecord } from "@/lib/types"

export const DRY_RUN_ASK_OVER = 500

export interface DryRun {
  /** New derived edges (no real link yet). */
  fresh: number
  /** Pairs that already have a real link of that relation. */
  known: number
  first: { from: string; to: string }[]
}

let cacheTasks: readonly ItemRecord[] | null = null
const cache = new Map<string, DryRun>()

export function dryRunRule(rule: RelationRule, tasks: readonly ItemRecord[], lattice: RelationLattice): DryRun {
  if (cacheTasks !== tasks) {
    cacheTasks = tasks
    cache.clear()
  }
  const key = JSON.stringify([rule.chain, rule.head, rule.unless, rule.guards])
  const hit = cache.get(key)
  if (hit) return hit
  const links = linkIndexOf(tasks)
  const live = { ...rule, enabled: true }
  const out: DryRun = { fresh: 0, known: 0, first: [] }
  for (const t of tasks) {
    for (const d of deriveAround(t.id, { links, rules: [live], lattice, transitive: [] })) {
      if (d.relation !== rule.head || d.proof.steps[0]?.from !== t.id) continue
      if (links.steps(t.id).some((s) => s.to === d.otherId && lattice.isSubrelation(s.relation, rule.head))) out.known++
      else {
        out.fresh++
        if (out.first.length < 10) out.first.push({ from: t.id, to: d.otherId })
      }
    }
  }
  cache.set(key, out)
  return out
}
