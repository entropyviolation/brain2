/**
 * components/Analytics/atlas/GraphAtlasView.tsx — Library → Atlas. The thin
 * container: reads the stores, builds the whole-vault graph
 * (`buildKnowledgeGraph`, `lib/graph/knowledge-graph.ts`) and the schema
 * category (`schemaCategory`, `lib/graph/schema-category.ts`), and hands them
 * to the two presentational plates. Read-only.
 */
"use client"

import { useMemo } from "react"
import { useItemTypeStore } from "@/lib/item-type-store"
import { buildKnowledgeGraph } from "@/lib/graph/knowledge-graph"
import { communities, insightSentences, pageRank } from "@/lib/graph/insights"
import { checkEquation, rulesAsEquations, schemaCategory } from "@/lib/graph/schema-category"
import { relationLabel } from "@/lib/links"
import { allRelations } from "@/lib/relation-registry"
import { useTaskStore } from "@/lib/task-store"
import { openItemsInLists } from "../studio/open-in-lists"
import { CanvasTitle } from "../studio/studio-kit"
import { GraphAtlas } from "./GraphAtlas"
import { SchemaCategoryDiagram } from "./SchemaCategoryDiagram"

export function GraphAtlasView() {
  const items = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const types = useItemTypeStore((s) => s.types)
  const relations = useItemTypeStore((s) => s.relations)
  const overrides = useItemTypeStore((s) => s.relationOverrides)
  const rules = useItemTypeStore((s) => s.relationRules)

  const defs = useMemo(() => allRelations().filter((d) => !d.archived), [relations, overrides]) // eslint-disable-line react-hooks/exhaustive-deps
  const typeName = useMemo(() => new Map(types.map((t) => [t.id as string, t.name])), [types])
  const typeLabel = (id: string) => typeName.get(id) ?? id
  const graph = useMemo(() => buildKnowledgeGraph({ items, lists, rules, defs, withDerived: true }), [items, lists, rules, defs])
  // Insights read recorded and observed edges only, so a rule's own output does not count as evidence for it.
  const facts = useMemo(() => ({ orders: ["recorded", "observed"] as const }), [])
  const rank = useMemo(() => new Map(pageRank(graph, { orders: [...facts.orders] }).map((r) => [r.id, r.score])), [graph, facts])
  const groups = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of communities(graph, { orders: [...facts.orders] })) for (const id of c.members) m.set(id, c.label)
    return m
  }, [graph, facts])
  const sentences = useMemo(() => insightSentences(graph, { orders: [...facts.orders], relationLabel, knownRules: rules }), [graph, facts, rules])
  const breaks = useMemo(
    () =>
      rulesAsEquations(rules).map((eq) => ({ eq, rows: checkEquation(graph, eq, { limit: 5 }) })).filter((b) => b.rows.length > 0),
    [graph, rules],
  )
  const label = (id: string) => graph.nodes.get(id)?.label ?? id
  const category = useMemo(() => schemaCategory(defs, [...typeName.keys()], typeLabel), [defs, typeName]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="an-canvas an-stack" data-testid="graph-atlas-view">
      <header className="an-canvas-head">
        <div>
          <CanvasTitle
            title="Atlas"
            help="Every node and edge the vault holds, read at open. Recorded edges are solid ink, observed are cobalt, derived are dashed, inferred are dotted. The nodes with the most edges are placed first; the count says how many are shown. Find a node to light its neighbourhood. Click a node for its edges. Nothing here writes a link."
          />
          <p className="an-canvas-kicker">
            {graph.nodes.size} nodes · {graph.edges.length} edges
          </p>
        </div>
      </header>
      <section className="an-plate" aria-label="Vault graph">
        <p className="an-canvas-title">Vault graph</p>
        <GraphAtlas
          graph={graph}
          typeLabel={typeLabel}
          insights={rank}
          communities={groups}
          onOpen={(node) => openItemsInLists({ taskIds: [node.id.replace(/^item:/, "")] })}
        />
      </section>
      <section className="an-plate" aria-label="What the graph shows" data-testid="atlas-insights">
        <p className="an-canvas-title">What the graph shows</p>
        {sentences.length ? (
          <ul className="atlas-insights">
            {sentences.map((i) => (
              <li key={i.id} data-order={i.order}>
                {i.sentence}
              </li>
            ))}
          </ul>
        ) : (
          <p className="an-canvas-kicker">Fewer than 7 linked items. Nothing to count yet.</p>
        )}
        {breaks.length ? (
          <>
            <p className="an-canvas-title">Where a rule&apos;s chain holds and its link is not written</p>
            <ul className="atlas-insights" data-testid="atlas-breaks">
              {breaks.map(({ eq, rows }) => (
                <li key={eq.id}>
                  {eq.left.map(relationLabel).join(" then ")} ⇒ {relationLabel(eq.right[0])}: {rows.map((r) => `${label(r.from)} → ${label(r.to)}`).join("; ")}
                  {rows.length === 5 ? " (first 5)" : ""}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
      <section className="an-plate" aria-label="Types and relations">
        <p className="an-canvas-title">Types and relations</p>
        <SchemaCategoryDiagram objects={category.objects} morphisms={category.morphisms} />
      </section>
    </div>
  )
}
