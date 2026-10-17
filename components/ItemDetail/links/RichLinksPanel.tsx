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
import { LinkLedger, visibleEdges } from "@/components/ItemDetail/links/LinkLedger"
import { useLinkItems } from "@/components/ItemDetail/links/link-items"
import { itemLinkTypeId } from "@/lib/item-types"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { useItemTypeStore } from "@/lib/item-type-store"
import { egoEdges, type EgoEdge } from "@/lib/link-graph"
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

/** Edges for an item's Links tab, dismissed suggestions left out (also the tab key's count). */
export function useItemEdges(task: Task | null): EgoEdge[] {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  // Relations made in this session relabel edges.
  const relations = useItemTypeStore((s) => s.relations)
  return useMemo(() => {
    if (!task) return []
    const derived = itemShowsPersonPipelines(task, lists) ? derivedSelfEdges(task, tasks) : []
    return visibleEdges(egoEdges(task, tasks, derived), task.dismissedLinkSuggestions)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, tasks, lists, relations])
}

export function RichLinksPanel({ task, editable = true, addLink, removeLink, writeDraft, onOpenItem }: RichLinksPanelProps) {
  const lists = useTaskStore((s) => s.lists)
  const types = useItemTypeStore((s) => s.types)
  const { tasks, facts, factsFor } = useLinkItems()
  const edges = useItemEdges(task)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [flashKey, setFlashKey] = useState<string | null>(null)
  const fromTypeId = itemLinkTypeId(task, lists)
  const fromTypeName = types.find((type) => type.id === fromTypeId)?.name ?? fromTypeId
  const title = itemTitleOrUntitled(task)

  return (
    <div className="rl" data-testid="rich-links">
      <LinkConstellation
        center={{ id: task.id, title, icon: task.icon }}
        edges={edges}
        factsFor={factsFor}
        allTasks={tasks}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
        onOpen={onOpenItem}
      />
      {editable ? (
        <LinkComposer
          centerId={task.id}
          centerTitle={title}
          fromTypeId={fromTypeId}
          fromTypeName={fromTypeName}
          edges={edges}
          tasks={tasks}
          facts={facts}
          onAdd={addLink}
          onDuplicate={setFlashKey}
        />
      ) : null}
      <LinkLedger
        edges={edges}
        factsFor={factsFor}
        selectedKey={selectedKey}
        flashKey={flashKey}
        onSelect={setSelectedKey}
        onOpen={onOpenItem}
        onRemove={removeLink}
        onConfirm={addLink}
        onPin={addLink}
        onDismiss={(key) => writeDraft({ dismissedLinkSuggestions: [...(task.dismissedLinkSuggestions ?? []), key] })}
      />
    </div>
  )
}
