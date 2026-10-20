/**
 * components/ItemDetail/links/use-links-graph.ts — Everything the Links tab
 * reasons about one item (LINKS_REDESIGN L3.3, L4, L5.2): derived edges with
 * proofs (only with **with derived** on), the suggestion shelf, the density
 * readout, and checks. Ego-scoped; nothing here is stored (invariant 7).
 */
"use client"

import { useMemo } from "react"
import { itemLinkTypeId } from "@/lib/item-types"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { useItemTypeStore } from "@/lib/item-type-store"
import { inverseRelation, relationLabel } from "@/lib/links"
import { allRelations, getRelationDef } from "@/lib/relation-registry"
import { useTaskStore } from "@/lib/task-store"
import { linkIndexOf } from "@/lib/graph/link-index"
import { buildLattice } from "@/lib/graph/relation-lattice"
import { deriveAround, type DerivedEdge } from "@/lib/graph/ego-reason"
import { egoDensity } from "@/lib/graph/ego-density"
import { egoChecks, type RelationCheck } from "@/lib/graph/relation-checks"
import { mergeSuggestions, suggestion, type DensifyContext, type Suggestion } from "@/lib/graph/densify"
import { reciprocalSource } from "@/lib/graph/densify/reciprocal"
import { triadSource } from "@/lib/graph/densify/triad"
import { coMemberSource } from "@/lib/graph/densify/co-member"
import { mentionSource } from "@/lib/graph/densify/mention"
import { openProposalsFor, useGraphInboxStore } from "@/lib/graph/graph-inbox-store"
import { useLinksViewStore } from "@/lib/graph/links-view-store"
import type { LinkStep } from "@/lib/graph/link-index"
import type { Task } from "@/lib/types"

export function useLinksGraph(task: Task) {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const relations = useItemTypeStore((s) => s.relations)
  const overrides = useItemTypeStore((s) => s.relationOverrides)
  const rules = useItemTypeStore((s) => s.relationRules)
  const withDerived = useLinksViewStore((s) => s.withDerived)
  const muted = useLinksViewStore((s) => s.mutedSources)
  const proposals = useGraphInboxStore((s) => s.proposals)

  return useMemo(() => {
    const links = linkIndexOf(tasks, task)
    const defs = allRelations()
    const lattice = buildLattice(defs)
    const transitive = defs.filter((d) => getRelationDef(d.id)?.traits?.transitive).map((d) => d.id)
    const byId = links.byId
    const typeOf = (id: string) => {
      const it = id === task.id ? task : byId.get(id)
      return it ? itemLinkTypeId(it, lists) : undefined
    }
    const title = (id: string) => itemTitleOrUntitled(id === task.id ? task : byId.get(id))
    const scopeOk = (relation: string, otherId: string) => {
      const def = getRelationDef(relation)
      const from = typeOf(task.id)
      const to = typeOf(otherId)
      return (!def?.fromTypes?.length || !from || def.fromTypes.includes(from)) && (!def?.toTypes?.length || !to || def.toTypes.includes(to))
    }

    const derivedAll: DerivedEdge[] = deriveAround(task.id, { links, rules, lattice, transitive, typeOf })
    const derived = withDerived ? derivedAll : []

    const ctx: DensifyContext = { all: tasks, links, title, scopeOk }
    const ruleSuggestions = derivedAll
      .filter((d) => getRelationDef(d.relation)?.reciprocity === "expect")
      .map((d) => suggestion(d.otherId, d.relation, "rule", d.proof.steps.map((s) => `${title(s.from)} ${relationLabel(s.relation)} ${title(s.to)}`).join("; "), 0.8))
    const proposalSuggestions: Suggestion[] = openProposalsFor(proposals, task.id).map((p) => {
      const out = p.sourceId === task.id
      const other = (out ? p.targetId : p.sourceId)!
      return { ...suggestion(other, out ? p.relation! : inverseRelation(p.relation!), "proposal", `${p.origin}: ${p.reason}`, p.score ?? 0.5, p.evidence), proposalId: p.id } as Suggestion
    })
    const suggestions = mergeSuggestions(
      task,
      [reciprocalSource(task, ctx), ruleSuggestions, triadSource(task, ctx), coMemberSource(task, ctx), mentionSource(task, ctx), proposalSuggestions],
      { links, muted, scopeOk },
    )

    const checkCtx = { links, getDef: getRelationDef, lattice, title, label: relationLabel, typeOf, outLinks: task.links ?? [] }
    const checks = egoChecks(task.id, checkCtx)
    const notes = new Map<string, string>()
    for (const c of checks) for (const k of c.edgeKeys) notes.set(k, notes.has(k) ? `${notes.get(k)} ${c.line}` : c.line)
    /** Checks a new link would add (composer pre-check). */
    const precheck = (relation: string, targetId: string): RelationCheck[] => {
      const have = new Set(checks.map((c) => c.line))
      const extra: LinkStep = { from: task.id, relation, to: targetId }
      return egoChecks(task.id, checkCtx, extra).filter((c) => !have.has(c.line))
    }

    return { links, lattice, derived, suggestions, density: egoDensity(task.id, links), checks, notes, precheck, title, rules }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, tasks, lists, relations, overrides, rules, withDerived, muted, proposals])
}
