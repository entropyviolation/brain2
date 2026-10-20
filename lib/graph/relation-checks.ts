/**
 * lib/graph/relation-checks.ts — Facts about one item's links that a
 * relation's traits speak to (LINKS_REDESIGN §5, L5.1).
 *
 * Pure, ego-scoped. Output states facts in neutral words, never verdicts
 * (invariant 10): scope, functional and inverse-functional counts, acyclic,
 * irreflexive, disjoint pairs. The unexplained many-to-one inverse check
 * lives in `relation-lattice.ts` (`unexplainedInverses`), since it reads
 * vocabulary, not links.
 */
import { edgeKey } from "@/lib/link-graph"
import { inverseRelation, type RelationDef } from "@/lib/links"
import { factFromOther, type LinkIndex, type LinkStep } from "@/lib/graph/link-index"
import type { RelationLattice } from "@/lib/graph/relation-lattice"

export type CheckKind = "scope" | "functional" | "inverse-functional" | "acyclic" | "irreflexive" | "disjoint"

export interface RelationCheck {
  kind: CheckKind
  edgeKeys: string[]
  line: string
}

export interface CheckContext {
  links: LinkIndex
  getDef: (id: string) => RelationDef | undefined
  lattice: RelationLattice
  title: (id: string) => string
  label: (relation: string) => string
  typeOf?: (id: string) => string | undefined
  /** Out links stored on the item (scope and irreflexive read only these). */
  outLinks?: { relation: string; targetId: string }[]
}

export function egoChecks(itemId: string, ctx: CheckContext, extra?: LinkStep): RelationCheck[] {
  const steps = [...ctx.links.steps(itemId), ...(extra ? [extra] : [])]
  const out: RelationCheck[] = []
  const me = ctx.title(itemId)

  // Irreflexive.
  for (const l of ctx.outLinks ?? []) {
    if (l.targetId === itemId) out.push({ kind: "irreflexive", edgeKeys: [edgeKey(itemId, l.relation)], line: `${me} links to itself (${ctx.label(l.relation)}).` })
  }

  // Scope: stored out links only, so a pair is reported once.
  if (ctx.typeOf) {
    const from = ctx.typeOf(itemId)
    for (const l of [...(ctx.outLinks ?? []), ...(extra ? [{ relation: extra.relation, targetId: extra.to }] : [])]) {
      const def = ctx.getDef(l.relation)
      const to = ctx.typeOf(l.targetId)
      const badFrom = def?.fromTypes?.length && from && !def.fromTypes.includes(from)
      const badTo = def?.toTypes?.length && to && !def.toTypes.includes(to)
      if (badFrom || badTo) out.push({ kind: "scope", edgeKeys: [edgeKey(l.targetId, l.relation)], line: `${ctx.label(l.relation)} is scoped to other types than ${me} → ${ctx.title(l.targetId)}.` })
    }
  }

  // Functional and inverse-functional.
  const relations = new Set<string>()
  for (const s of steps) {
    const back = factFromOther(s, inverseRelation)
    for (const r of [s.relation, ...ctx.lattice.ancestors(s.relation), back, ...ctx.lattice.ancestors(back)]) relations.add(r)
  }
  for (const r of relations) {
    const traits = ctx.getDef(r)?.traits
    if (!traits) continue
    const count = (relation: string) => {
      const hits = steps.filter((s) => ctx.lattice.isSubrelation(s.relation, relation))
      return [...new Map(hits.map((s) => [s.to, s])).values()]
    }
    if (traits.functional) {
      const hits = count(r)
      if (hits.length > traits.functional) out.push({ kind: "functional", edgeKeys: hits.map((s) => edgeKey(s.to, s.relation)), line: `${me} ${ctx.label(r)} ${hits.map((s) => ctx.title(s.to)).join(", ")}: ${hits.length} of max ${traits.functional}.` })
    }
    if (traits.inverseFunctional) {
      const hits = [...new Map(steps.filter((s) => ctx.lattice.isSubrelation(factFromOther(s, inverseRelation), r)).map((s) => [s.to, s])).values()]
      if (hits.length > traits.inverseFunctional) out.push({ kind: "inverse-functional", edgeKeys: hits.map((s) => edgeKey(s.to, s.relation)), line: `${hits.length} items ${ctx.label(r)} ${me} (${hits.map((s) => ctx.title(s.to)).join(", ")}): max ${traits.inverseFunctional}.` })
    }
    if (traits.acyclic) {
      const cycle = cycleThrough(itemId, r, ctx, extra)
      if (cycle) out.push({ kind: "acyclic", edgeKeys: [edgeKey(cycle[0].to, cycle[0].relation)], line: `${ctx.label(r)} loops: ${[me, ...cycle.map((s) => ctx.title(s.to))].join(" → ")}.` })
    }
    for (const d of traits.disjointWith ?? []) {
      const byOther = new Map<string, LinkStep[]>()
      for (const s of steps) (byOther.get(s.to) ?? byOther.set(s.to, []).get(s.to)!).push(s)
      for (const [other, list] of byOther) {
        if (list.some((s) => ctx.lattice.isSubrelation(s.relation, r)) && list.some((s) => ctx.lattice.isSubrelation(s.relation, d))) {
          out.push({ kind: "disjoint", edgeKeys: list.map((s) => edgeKey(other, s.relation)), line: `${me} both ${ctx.label(r)} and ${ctx.label(d)} ${ctx.title(other)}.` })
        }
      }
    }
  }
  const seen = new Set<string>()
  return out.filter((c) => (seen.has(c.line) ? false : (seen.add(c.line), true)))
}

function cycleThrough(itemId: string, r: string, ctx: CheckContext, extra?: LinkStep, depth = 6): LinkStep[] | null {
  const stepsOf = (id: string) => [...ctx.links.steps(id), ...(extra && extra.from === id ? [extra] : [])].filter((s) => ctx.lattice.isSubrelation(s.relation, r))
  let frontier: { id: string; path: LinkStep[] }[] = [{ id: itemId, path: [] }]
  const seen = new Set<string>()
  for (let d = 0; d < depth && frontier.length; d++) {
    const next: typeof frontier = []
    for (const { id, path } of frontier) {
      for (const s of stepsOf(id)) {
        if (s.to === itemId && path.length >= 1) return [...path, s]
        if (seen.has(s.to) || s.to === itemId) continue
        seen.add(s.to)
        next.push({ id: s.to, path: [...path, s] })
      }
    }
    frontier = next
  }
  return null
}
