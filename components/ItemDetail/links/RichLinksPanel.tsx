/**
 * components/ItemDetail/links/RichLinksPanel.tsx — The Links tab
 *
 * Constellation, then the sentence composer, then the ledger, for any item.
 * Edges come from `lib/link-graph.ts`: this draft's own links plus links
 * other saved items point here, merged into one edge when both sides say
 * it. People also get derived edges from Relation words
 * (`lib/self-relations.ts`). Every link write goes on the draft, so Save
 * and the unsaved guard cover it; `onOpenItem` is the host's guarded open.
 */
"use client"

import { useMemo, useState } from "react"
import { LinkComposer } from "@/components/ItemDetail/links/LinkComposer"
import { LinkConstellation } from "@/components/ItemDetail/links/LinkConstellation"
import { LinkLedger } from "@/components/ItemDetail/links/LinkLedger"
import { itemLinkTypeId } from "@/lib/item-types"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { useItemTypeStore } from "@/lib/item-type-store"
import { egoEdges, secondRing, type EgoEdge } from "@/lib/link-graph"
import { itemShowsPersonPipelines } from "@/lib/people-i-know"
import { derivedSelfEdges } from "@/lib/self-relations"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import "./rich-links.css"

interface RichLinksPanelProps {
  task: Task
  /** False on the page shell until Edit: the picture and ledger still show. */
  editable?: boolean
  addLink: (relation: string, targetId: string) => void
  removeLink: (linkId: string) => void
  writeDraft: (patch: Partial<Task>) => void
  onOpenItem: (id: string) => void
}

/** Edges for an item's Links tab (also used for the tab key's count). */
export function useItemEdges(task: Task | null): EgoEdge[] {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  // Relations made in this session relabel edges.
  const relations = useItemTypeStore((s) => s.relations)
  return useMemo(() => {
    if (!task) return []
    const derived = itemShowsPersonPipelines(task, lists)
      ? derivedSelfEdges(task, tasks, task.dismissedLinkSuggestions)
      : []
    return egoEdges(task, tasks, derived)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, tasks, lists, relations])
}

export function RichLinksPanel({ task, editable = true, addLink, removeLink, writeDraft, onOpenItem }: RichLinksPanelProps) {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const types = useItemTypeStore((s) => s.types)
  const edges = useItemEdges(task)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [showSecondRing, setShowSecondRing] = useState(false)
  const byId = useMemo(() => {
    const map = new Map(tasks.map((t) => [t.id, t]))
    map.set(task.id, task)
    return map
  }, [tasks, task])
  const ring = useMemo(() => secondRing(task.id, edges, tasks), [task.id, edges, tasks])
  const sourceTypeId = itemLinkTypeId(task, lists)
  const typeName = (item: Task) => {
    const id = itemLinkTypeId(item, lists)
    return types.find((type) => type.id === id)?.name ?? id
  }

  return (
    <div className="rl" data-testid="rich-links">
      <LinkConstellation
        center={task}
        edges={edges}
        secondRing={ring}
        showSecondRing={showSecondRing}
        onToggleSecondRing={() => setShowSecondRing((v) => !v)}
        byId={byId}
        activeKey={activeKey}
        onActive={setActiveKey}
        onOpenItem={onOpenItem}
      />
      {editable ? (
        <LinkComposer
          sourceId={task.id}
          sourceTitle={itemTitleOrUntitled(task)}
          sourceTypeId={sourceTypeId}
          existing={(task.links ?? []).map((link) => ({ relation: link.relation, targetId: link.targetId }))}
          onAdd={addLink}
        />
      ) : null}
      <LinkLedger
        edges={edges}
        byId={byId}
        typeName={typeName}
        activeKey={activeKey}
        onActive={setActiveKey}
        editable={editable}
        onOpenItem={onOpenItem}
        onRemove={removeLink}
        onConfirm={(edge) => addLink(edge.relation, edge.otherId)}
        onDismiss={(edge) =>
          writeDraft({ dismissedLinkSuggestions: [...(task.dismissedLinkSuggestions ?? []), edge.key] })
        }
      />
    </div>
  )
}
