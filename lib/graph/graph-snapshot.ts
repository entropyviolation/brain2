/**
 * lib/graph/graph-snapshot.ts — Graph snapshot export (LINKS_REDESIGN §11.2,
 * L8.2). One JSON file: vocabulary, lattice parents, rules, items as
 * `{id, type, title, lists, tags}`, and links. Private subgraphs (KG-P7) are
 * left out by default and listed in `leftOut`.
 */
import type { RelationDef } from "@/lib/links"
import type { RelationRule } from "@/lib/graph/relation-rules"
import { PROPOSAL_SCHEMA } from "@/lib/graph/proposal-schema"
import type { ItemRecord } from "@/lib/types"

/** Types and lists whose items stay home unless asked (cycle, sleep, mood, intake). */
export const PRIVATE_MARKERS = ["cycle", "sleep", "mood", "intake", "medication", "symptom"]

export function isPrivateItem(item: ItemRecord): boolean {
  const words = [item.type ?? "", ...(item.lists ?? []), ...(item.tags ?? [])].map((w) => String(w).toLowerCase())
  return words.some((w) => PRIVATE_MARKERS.some((m) => w.includes(m)))
}

export function graphSnapshot(input: {
  tasks: readonly ItemRecord[]
  relations: readonly RelationDef[]
  rules: readonly RelationRule[]
  title: (item: ItemRecord) => string
  includePrivate?: boolean
  now?: Date
}) {
  const kept = input.tasks.filter((t) => input.includePrivate || !isPrivateItem(t))
  const keep = new Set(kept.map((t) => t.id))
  const leftOut = input.tasks.length - kept.length
  return {
    $kind: "brain2-graph-snapshot",
    $version: 1,
    exportedAt: (input.now ?? new Date()).toISOString(),
    $proposalSchema: PROPOSAL_SCHEMA,
    leftOut: { privateItems: leftOut, markers: input.includePrivate ? [] : PRIVATE_MARKERS, notes: "Item notes and bodies are never exported." },
    relations: input.relations.map(({ id, label, inverse, inverseLabel, parent, family, fromTypes, toTypes, traits, description, aliasOf }) => ({ id, label, inverse, inverseLabel, parent, family, fromTypes, toTypes, traits, description, aliasOf })),
    rules: input.rules,
    items: kept.map((t) => ({ id: t.id, type: t.type, title: input.title(t), lists: t.lists ?? [], tags: t.tags ?? [] })),
    links: kept.flatMap((t) => (t.links ?? []).filter((l) => keep.has(l.targetId)).map((l) => ({ sourceId: t.id, relation: l.relation, targetId: l.targetId }))),
  }
}
