/**
 * lib/graph-bimby/ghosts.ts — Draw waiting changes on the graph (pure)
 *
 * Every change on a Graph BIMBY card that is still waiting (or failed) for the item at the center is drawn as a
 * proposed node, on a dashed edge from the center, labeled by what it would add. Accept or Reject from the
 * node's inspector, or from the card in CHAT; an accepted change turns into the real node it wrote.
 */

import type { GraphEdge, GraphNode, MemoryGraph } from "@/lib/memory-graph/build"
import type { Effect, ReportPlan } from "@/lib/report-bimby/types"

const EDGE_SAYS: Partial<Record<Effect["kind"], string>> = {
  "item-note": "note",
  consider: "considering",
  fact: "fact",
  place: "lives in",
  kin: "relation",
  relation: "to you",
  seen: "saw",
  todo: "to do",
  step: "part",
  amend: "amend",
  birthday: "birthday",
  contact: "contact",
  group: "group",
}

const cut = (text: string, n: number) => (text.length > n ? `${text.slice(0, n - 1)}…` : text)

/** The graph plus a proposed node for each waiting change about the center. */
export function withProposals(graph: MemoryGraph, plans: readonly ReportPlan[]): MemoryGraph {
  const nodes: GraphNode[] = [...graph.nodes]
  const edges: GraphEdge[] = [...graph.edges]
  for (const plan of plans) {
    const about = plan.aboutIds ?? (plan.about ? [plan.about] : [])
    if (!about.includes(graph.centerId)) continue
    for (const e of plan.effects) {
      if (e.status !== "pending" && e.status !== "failed") continue
      const id = `prop:${e.id}`
      nodes.push({
        id,
        kind: "proposal",
        label: cut(e.title.replace(/^(?:To Do|Fact|Considering|Part of [^:]+): /, ""), 40),
        facts: [`proposed ${EDGE_SAYS[e.kind] ?? e.kind}${e.status === "failed" ? " · failed" : ""}`, ...e.reasoning.slice(0, 2), ...e.evidence.slice(0, 1), ...(e.result ? [e.result] : [])],
        proposal: { planId: plan.id, effectId: e.id },
      })
      edges.push({ a: graph.centerId, b: id, label: `proposed: ${EDGE_SAYS[e.kind] ?? e.kind}`, proposed: true })
    }
  }
  return { ...graph, nodes, edges }
}

/** How many changes wait on this item. */
export function waitingFor(itemId: string, plans: readonly ReportPlan[]): number {
  let n = 0
  for (const p of plans) if ((p.aboutIds ?? (p.about ? [p.about] : [])).includes(itemId)) n += p.effects.filter((e) => e.status === "pending").length
  return n
}
