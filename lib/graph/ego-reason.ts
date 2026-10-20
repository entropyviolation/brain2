/**
 * lib/graph/ego-reason.ts — Derived edges around one item, with proofs
 * (LINKS_REDESIGN §9.2, L3.2).
 *
 * Pure and ego-sized: chain rules walk at most three steps out (both ways:
 * the item can be ?a or ?z), and transitive closure walks at most `depth`
 * (default 6) with a visited set, so cycles stop. Subrelations are not
 * emitted as edges; the lattice answers "is this family?" instead. A step
 * matches a chain relation r when its relation ⊑ r.
 *
 * Output feeds `egoEdges(item, all, derived)`, which drops a derived edge
 * when a real edge has its key.
 */
import { inverseRelation } from "@/lib/links"
import { edgeKey, relationFamily, type EgoEdge } from "@/lib/link-graph"
import { factFromOther, type LinkIndex, type LinkStep } from "@/lib/graph/link-index"
import type { RelationLattice } from "@/lib/graph/relation-lattice"
import type { RelationRule } from "@/lib/graph/relation-rules"

export interface DerivedProof {
  ruleId?: string
  trait?: "transitive"
  /** Forward, from ?a to ?z. */
  steps: LinkStep[]
}

export interface DerivedEdge extends EgoEdge {
  proof: DerivedProof
}

export interface ReasonContext {
  links: LinkIndex
  rules: readonly RelationRule[]
  lattice: RelationLattice
  /** Relation ids with the transitive trait. */
  transitive: readonly string[]
  /** Item type for guards. */
  typeOf?: (id: string) => string | undefined
  depth?: number
}

export const CLOSURE_DEPTH = 6

export function deriveAround(itemId: string, ctx: ReasonContext): DerivedEdge[] {
  const found = new Map<string, DerivedEdge>()
  const add = (otherId: string, relation: string, proof: DerivedProof) => {
    if (otherId === itemId) return
    const key = edgeKey(otherId, relation)
    const prev = found.get(key)
    if (prev && prev.proof.steps.length <= proof.steps.length) return
    found.set(key, {
      key,
      otherId,
      relation,
      direction: "derived",
      family: relationFamily(relation),
      derivedFrom: proof.ruleId ? `rule:${proof.ruleId}` : "transitive",
      proof,
    })
  }
  const sub = (r: string, s: string) => ctx.lattice.isSubrelation(r, s)
  const guardOk = (rule: RelationRule, i: number, id: string) => {
    const g = rule.guards?.[i]
    if (!g?.length || !ctx.typeOf) return true
    const t = ctx.typeOf(id)
    return !!t && g.includes(t)
  }
  const holds = (a: string, z: string, relation: string) => ctx.links.steps(a).some((s) => s.to === z && sub(s.relation, relation))

  for (const rule of ctx.rules) {
    if (!rule.enabled || !rule.chain.length) continue
    const n = rule.chain.length
    // Forward: item is ?a.
    if (guardOk(rule, 0, itemId)) {
      const walk = (at: string, i: number, path: LinkStep[]) => {
        if (i === n) {
          if (!guardOk(rule, n, at) || (rule.unless && holds(itemId, at, rule.unless))) return
          add(at, rule.head, { ruleId: rule.id, steps: path })
          return
        }
        for (const s of ctx.links.steps(at)) {
          if (!sub(s.relation, rule.chain[i]) || path.some((p) => p.from === s.to) || s.to === itemId) continue
          if (i + 1 < n && !guardOk(rule, i + 1, s.to)) continue
          walk(s.to, i + 1, [...path, s])
        }
      }
      walk(itemId, 0, [])
    }
    // Backward: item is ?z. Read each step back as a forward fact.
    if (guardOk(rule, n, itemId)) {
      const walk = (at: string, i: number, path: LinkStep[]) => {
        if (i < 0) {
          if (!guardOk(rule, 0, at) || (rule.unless && holds(at, itemId, rule.unless))) return
          add(at, inverseRelation(rule.head), { ruleId: rule.id, steps: path })
          return
        }
        for (const s of ctx.links.steps(at)) {
          const fact = factFromOther(s, inverseRelation)
          if (!sub(fact, rule.chain[i]) || path.some((p) => p.to === s.to) || s.to === itemId) continue
          if (i > 0 && !guardOk(rule, i, s.to)) continue
          walk(s.to, i - 1, [{ from: s.to, relation: fact, to: at, linkId: s.linkId }, ...path])
        }
      }
      walk(itemId, n - 1, [])
    }
  }

  const depth = ctx.depth ?? CLOSURE_DEPTH
  for (const r of ctx.transitive) {
    const seen = new Set([itemId])
    let frontier: { id: string; path: LinkStep[] }[] = [{ id: itemId, path: [] }]
    for (let d = 1; d <= depth && frontier.length; d++) {
      const next: typeof frontier = []
      for (const { id, path } of frontier) {
        for (const s of ctx.links.steps(id)) {
          if (!sub(s.relation, r) || seen.has(s.to)) continue
          seen.add(s.to)
          const p = [...path, s]
          if (d >= 2) add(s.to, r, { trait: "transitive", steps: p })
          next.push({ id: s.to, path: p })
        }
      }
      frontier = next
    }
  }

  return [...found.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
}
