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
import { EdgeInspector } from "@/components/ItemDetail/links/EdgeInspector"
import { LinkMatrix } from "@/components/ItemDetail/links/LinkMatrix"
import { LinkPath } from "@/components/ItemDetail/links/LinkPath"
import { SuggestionShelf } from "@/components/ItemDetail/links/SuggestionShelf"
import { useLinksGraph } from "@/components/ItemDetail/links/use-links-graph"
import { useGraphInboxStore } from "@/lib/graph/graph-inbox-store"
import { useLinksViewStore } from "@/lib/graph/links-view-store"
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

const NO_EDGES: EgoEdge[] = []
type View = "radial" | "matrix" | "path" | "ledger"
const VIEWS: { id: View; label: string }[] = [
  { id: "radial", label: "Radial" },
  { id: "matrix", label: "Matrix" },
  { id: "path", label: "Path" },
  { id: "ledger", label: "Ledger" },
]

/** Edges for an item's Links tab, dismissed suggestions left out (also the tab key's count). */
export function useItemEdges(task: Task | null, extraDerived: readonly EgoEdge[] = NO_EDGES): EgoEdge[] {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  // Relations made in this session relabel edges.
  const relations = useItemTypeStore((s) => s.relations)
  return useMemo(() => {
    if (!task) return []
    const derived = itemShowsPersonPipelines(task, lists) ? derivedSelfEdges(task, tasks) : []
    return visibleEdges(egoEdges(task, tasks, [...derived, ...extraDerived]), task.dismissedLinkSuggestions)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, tasks, lists, relations, extraDerived])
}

export function RichLinksPanel({ task, editable = true, addLink, removeLink, writeDraft, onOpenItem }: RichLinksPanelProps) {
  const lists = useTaskStore((s) => s.lists)
  const types = useItemTypeStore((s) => s.types)
  const { tasks, facts, factsFor } = useLinkItems()
  const graph = useLinksGraph(task)
  const edges = useItemEdges(task, graph.derived)
  const withDerived = useLinksViewStore((s) => s.withDerived)
  const setWithDerived = useLinksViewStore((s) => s.setWithDerived)
  const toggleMuted = useLinksViewStore((s) => s.toggleMuted)
  const setProposalStatus = useGraphInboxStore((s) => s.setStatus)
  const [view, setView] = useState<View>("radial")
  const [inspectKey, setInspectKey] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [flashKey, setFlashKey] = useState<string | null>(null)
  const fromTypeId = itemLinkTypeId(task, lists)
  const fromTypeName = types.find((type) => type.id === fromTypeId)?.name ?? fromTypeId
  const title = itemTitleOrUntitled(task)
  const counts = { out: 0, in: 0, mutual: 0, derived: 0 }
  for (const e of edges) counts[e.direction]++
  const inspected = inspectKey ? edges.find((e) => e.key === inspectKey) : undefined
  const dismiss = (key: string) => writeDraft({ dismissedLinkSuggestions: [...(task.dismissedLinkSuggestions ?? []), key] })
  const addChecked = (relation: string, targetId: string) => {
    const fresh = graph.precheck(relation, targetId)
    const cycle = fresh.find((c) => c.kind === "acyclic")
    if (cycle && typeof window !== "undefined" && !window.confirm(`${cycle.line} Add it anyway?`)) return
    setNote(fresh.length ? fresh.map((c) => c.line).join(" ") : null)
    addLink(relation, targetId)
  }

  return (
    <div className="rl" data-testid="rich-links">
      <div className="rl-readout" data-testid="link-readout">
        <span>
          {counts.out} out · {counts.in} in · {counts.mutual} mutual{counts.derived ? ` · ${counts.derived} derived` : ""}
        </span>
        <span title="Local clustering: how many of this item's neighbours link to each other">
          {graph.density.clustering === null ? "" : `C ${graph.density.clustering.toFixed(2)} · `}
          {graph.density.openTriads.length} open
        </span>
      </div>
      <div className="rl-viewbar">
        <span role="tablist" aria-label="Links view">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" role="tab" aria-selected={view === v.id} className="rl-key" onClick={() => setView(v.id)}>
              {v.label}
            </button>
          ))}
        </span>
        <label className="rl-derived-switch">
          <input type="checkbox" checked={withDerived} onChange={(e) => setWithDerived(e.target.checked)} /> with derived
        </label>
      </div>
      {view === "matrix" ? <LinkMatrix itemId={task.id} links={graph.links} title={graph.title} /> : null}
      {view === "path" ? <LinkPath itemId={task.id} links={graph.links} tasks={tasks} title={graph.title} onOpen={onOpenItem} /> : null}
      {view === "radial" ? (
      <LinkConstellation
        center={{ id: task.id, title, icon: task.icon }}
        edges={edges}
        factsFor={factsFor}
        allTasks={tasks}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
        onOpen={onOpenItem}
      />
      ) : null}
      {inspected ? (
        <EdgeInspector
          edge={inspected}
          centerTitle={title}
          title={graph.title}
          rules={graph.rules}
          note={graph.notes.get(inspected.key)}
          onOpen={onOpenItem}
          onClose={() => setInspectKey(null)}
        />
      ) : null}
      {editable ? (
        <LinkComposer
          centerId={task.id}
          centerTitle={title}
          fromTypeId={fromTypeId}
          fromTypeName={fromTypeName}
          edges={edges}
          tasks={tasks}
          facts={facts}
          onAdd={addChecked}
          onDuplicate={setFlashKey}
        />
      ) : null}
      {note ? (
        <p className="rl-note" data-testid="link-precheck">
          {note}
        </p>
      ) : null}
      <SuggestionShelf
        suggestions={graph.suggestions}
        title={graph.title}
        editable={editable}
        onAccept={(s) => {
          addLink(s.relation, s.otherId)
          const pid = (s as { proposalId?: string }).proposalId
          if (pid) setProposalStatus(pid, "accepted")
        }}
        onDismiss={(s) => {
          dismiss(s.key)
          const pid = (s as { proposalId?: string }).proposalId
          if (pid) setProposalStatus(pid, "dismissed")
        }}
        onMute={toggleMuted}
        onOpen={onOpenItem}
      />
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
        onDismiss={dismiss}
        onWhy={setInspectKey}
        notes={graph.notes}
      />
    </div>
  )
}
