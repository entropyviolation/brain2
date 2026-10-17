/**
 * components/ItemDetail/links/LinkComposer.tsx — One sentence that adds a
 * link (PD 6.2): `{this item} [relation ▾] [search… other item] [Link]`.
 *
 * The relation box (`RelationCombobox`) lists this type's relations first and
 * can create a new one (`NewRelationForm`, a store write). The target box
 * (`LinkTargetSearch`) leaves out items already linked with that relation and
 * honors the relation's `toTypes`. Link calls `onAdd(relation, targetId)`: the
 * host's `addLink`, a draft edit covered by Save and the unsaved guard. A
 * pair that already exists is refused: no `onAdd`, `onDuplicate(edgeKey)` so
 * the host can flash the ledger row.
 */
"use client"

import { useMemo, useState } from "react"
import { LinkTargetSearch } from "@/components/ItemDetail/links/LinkTargetSearch"
import { createListItem } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import { NewRelationForm } from "@/components/ItemDetail/links/NewRelationForm"
import { RelationCombobox } from "@/components/ItemDetail/links/RelationCombobox"
import type { LinkItemFacts } from "@/components/ItemDetail/links/link-items"
import { edgeKey, type EgoEdge } from "@/lib/link-graph"
import { relationsFor, getRelationDef } from "@/lib/relation-registry"
import type { Task } from "@/lib/types"
import "./rich-links.css"

export function LinkComposer({
  centerId,
  centerTitle,
  fromTypeId,
  fromTypeName,
  edges,
  tasks,
  facts,
  onAdd,
  onDuplicate,
}: {
  centerId: string
  centerTitle: string
  fromTypeId?: string
  fromTypeName?: string
  /** Current edges around the center (`egoEdges`), to refuse duplicates. */
  edges: readonly EgoEdge[]
  tasks: readonly Task[]
  facts: (task: Task) => LinkItemFacts
  onAdd: (relation: string, targetId: string) => void
  onDuplicate?: (key: string) => void
}) {
  const [relation, setRelation] = useState(() => relationsFor(fromTypeId)[0]?.id ?? "related")
  const [target, setTarget] = useState<LinkItemFacts | null>(null)
  const [creating, setCreating] = useState<string | null>(null)

  // Keys this item already holds as its own link (out or mutual). In-only rows can still be confirmed.
  const ownKeys = useMemo(
    () => new Set(edges.filter((e) => e.direction === "out" || e.direction === "mutual").map((e) => e.key.split("#")[0])),
    [edges],
  )
  const excludeIds = useMemo(() => {
    const ids = new Set<string>([centerId])
    for (const task of tasks) if (ownKeys.has(edgeKey(task.id, relation))) ids.add(task.id)
    return ids
  }, [centerId, tasks, ownKeys, relation])

  const toTypes = getRelationDef(relation)?.toTypes

  // A new target item is a store write at once (like a new relation). The link stays a draft.
  const createTarget = (title: string) => {
    const base = createListItem(title)
    const task = { ...base, type: (toTypes?.[0] ?? base.type) as Task["type"] } as Task
    useTaskStore.getState().addTask(task)
    setTarget(facts(task))
  }

  const submit = () => {
    if (!target) return
    const key = edgeKey(target.id, relation)
    if (ownKeys.has(key)) {
      onDuplicate?.(key)
      return
    }
    onAdd(relation, target.id)
    setTarget(null)
  }

  return (
    <div className="rl-composer" aria-label="Add a link" role="group">
      <div className="rl-sentence">
        <span className="rl-subject" title={centerTitle}>
          {centerTitle}
        </span>
        <RelationCombobox
          value={relation}
          onChange={(id) => {
            setRelation(id)
            setCreating(null)
          }}
          onCreate={(phrase) => setCreating(phrase)}
          fromTypeId={fromTypeId}
          fromTypeName={fromTypeName}
          toTypeId={target?.typeIds[0]}
        />
        <LinkTargetSearch
          tasks={tasks}
          facts={facts}
          selected={target}
          onSelect={setTarget}
          onCreate={createTarget}
          excludeIds={excludeIds}
          toTypes={toTypes}
        />
        <button type="button" className="rl-key" disabled={!target} onClick={submit}>
          Link
        </button>
      </div>
      {creating !== null ? (
        <NewRelationForm
          key={creating}
          phrase={creating}
          fromTypeId={fromTypeId}
          onCancel={() => setCreating(null)}
          onCreated={(id) => {
            setRelation(id)
            setCreating(null)
          }}
        />
      ) : null}
    </div>
  )
}
