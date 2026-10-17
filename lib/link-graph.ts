/**
 * lib/link-graph.ts — The links around one item, read from that item (6.1).
 *
 * Pure. Feeds the Links tab (constellation, ledger, suggestions).
 *
 * - Outgoing links come from the item passed in (the draft), read as
 *   `link.relation`.
 * - Incoming links come from `all` (saved store tasks; the item's own saved
 *   copy is skipped), read through `inverseRelation`.
 * - An outgoing and an incoming edge to the same other item with the same
 *   canonical relation (`min(R, inverse(R))`) merge into one `mutual` edge.
 *   So "Elijah is the mother of Oey" plus "Oey is the child of Elijah" is one
 *   pair, even though `child-of` reads back as `parent-of`.
 * - Derived edges (7.1) drop when a real edge has the same key.
 *
 * Backlinks come from `taskIndexOf(all)` (`lib/task-index.ts`), which is
 * cached by array identity, so the store's tasks array is scanned once.
 */
import { getRelationDef } from "@/lib/relation-registry"
import { inverseRelation, isEvidenceRelation, isKnownRelation, type RelationFamily } from "@/lib/links"
import { taskIndexOf } from "@/lib/task-index"
import type { ItemRecord } from "@/lib/types"

export type EdgeDirection = "out" | "in" | "mutual" | "derived"

export interface EgoEdge {
  /** `${otherId}|${canonicalRelation}` (a `#linkId` suffix only on a duplicate pair). */
  key: string
  otherId: string
  /** As read from THIS item. */
  relation: string
  direction: EdgeDirection
  /** The link on this item's draft. */
  outLinkId?: string
  inLink?: { sourceId: string; linkId: string; relation: string }
  family: RelationFamily
  /** e.g. "relation-field". */
  derivedFrom?: string
  /** Free label for a derived edge with no seed (e.g. the word "coach"). */
  label?: string
}

type LinkedItem = Pick<ItemRecord, "id" | "links">

/** The smaller of a relation id and its inverse: one name for both directions. */
export function canonicalRelation(relation: string): string {
  const inv = inverseRelation(relation)
  return inv < relation ? inv : relation
}

export function edgeKey(otherId: string, relation: string): string {
  return `${otherId}|${canonicalRelation(relation)}`
}

/** Constellation sector for a relation. */
export function relationFamily(relation: string): RelationFamily {
  const def = getRelationDef(relation)
  if (def?.family) return def.family
  if (isEvidenceRelation(relation)) return "evidence"
  if (isKnownRelation(relation) && relation !== "related") return "task"
  return "other"
}

/** Every edge around `item`. Order: outgoing in link order, then incoming, then derived. */
export function egoEdges(item: LinkedItem, all: readonly ItemRecord[], derived: EgoEdge[] = []): EgoEdge[] {
  const edges: EgoEdge[] = []
  const byKey = new Map<string, EgoEdge>()

  for (const link of item.links ?? []) {
    if (!link?.targetId || !link.relation || link.targetId === item.id) continue
    let key = edgeKey(link.targetId, link.relation)
    if (byKey.has(key)) key = `${key}#${link.id}`
    const edge: EgoEdge = {
      key,
      otherId: link.targetId,
      relation: link.relation,
      direction: "out",
      outLinkId: link.id,
      family: relationFamily(link.relation),
    }
    byKey.set(key, edge)
    edges.push(edge)
  }

  const sources = taskIndexOf(all as ItemRecord[]).backlinks.get(item.id) ?? []
  const seenSource = new Set<string>()
  for (const source of sources) {
    if (source.id === item.id || seenSource.has(source.id)) continue
    seenSource.add(source.id)
    for (const link of source.links ?? []) {
      if (link?.targetId !== item.id || !link.relation) continue
      const relation = inverseRelation(link.relation)
      const key = edgeKey(source.id, relation)
      const inLink = { sourceId: source.id, linkId: link.id, relation: link.relation }
      const existing = byKey.get(key)
      if (existing) {
        if (existing.direction === "out") {
          existing.direction = "mutual"
          existing.inLink = inLink
        }
        continue
      }
      const edge: EgoEdge = {
        key,
        otherId: source.id,
        relation,
        direction: "in",
        inLink,
        family: relationFamily(relation),
      }
      byKey.set(key, edge)
      edges.push(edge)
    }
  }

  for (const d of derived) {
    if (!d?.otherId || d.otherId === item.id) continue
    const key = d.key || edgeKey(d.otherId, d.relation)
    if (byKey.has(key)) continue
    const edge: EgoEdge = { ...d, key, direction: "derived" }
    byKey.set(key, edge)
    edges.push(edge)
  }

  return edges
}

/**
 * Second-degree neighbors: for each ring-1 item, its own real edges to items
 * that are neither the center nor on ring 1. Each outer item appears once
 * (first ring-1 item that reaches it). Stops at `limit`. Pass `centerId`
 * (the plan's signature had no slot for it) so the center never shows up.
 */
export function secondRing(
  edges: readonly EgoEdge[],
  all: readonly ItemRecord[],
  limit: number,
  centerId?: string,
): { from: string; edge: EgoEdge }[] {
  const out: { from: string; edge: EgoEdge }[] = []
  if (limit <= 0) return out
  const byId = taskIndexOf(all as ItemRecord[]).byId
  const ring1 = new Set(edges.filter((e) => e.direction !== "derived").map((e) => e.otherId))
  const taken = new Set<string>()
  for (const id of ring1) {
    const other = byId.get(id)
    if (!other) continue
    for (const edge of egoEdges(other, all)) {
      if (edge.otherId === centerId || ring1.has(edge.otherId) || taken.has(edge.otherId)) continue
      taken.add(edge.otherId)
      out.push({ from: id, edge })
      if (out.length >= limit) return out
    }
  }
  return out
}

/** The Links tab key's count: real edges only, suggestions left out. */
export function edgeCount(edges: readonly EgoEdge[]): number {
  return edges.filter((e) => e.direction !== "derived").length
}
