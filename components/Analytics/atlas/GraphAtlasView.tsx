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
import { schemaCategory } from "@/lib/graph/schema-category"
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
          onOpen={(node) => openItemsInLists({ taskIds: [node.id.replace(/^item:/, "")] })}
        />
      </section>
      <section className="an-plate" aria-label="Types and relations">
        <p className="an-canvas-title">Types and relations</p>
        <SchemaCategoryDiagram objects={category.objects} morphisms={category.morphisms} />
      </section>
    </div>
  )
}
