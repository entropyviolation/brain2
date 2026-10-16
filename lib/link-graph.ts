/**
 * lib/link-graph.ts — One item's links as edges, read from that item
 *
 * Links are stored on the source only (`Task.links`). From an item's side:
 * an outgoing link reads as its relation; an incoming link from X with
 * relation S reads as `inverseRelation(S)`. When this item says R about X
 * and X says something that reads back as R, the two are one **mutual**
 * edge. Derived edges (not stored, e.g. self's Relation words) drop out when
 * a real edge has the same key. Outgoing links come from the draft; incoming
 * from the saved store, through the task index.
 */
import { inverseRelation, relationLabel } from "@/lib/links"
import { relationFamily } from "@/lib/relation-registry"
import { taskIndexOf } from "@/lib/task-index"
import type { ItemRecord, Task } from "@/lib/types"

export type EdgeDirection = "out" | "in" | "mutual" | "derived"

export interface EgoEdge {
  /** `${otherId}|${canonicalRelation}` */
  key: string
  otherId: string
  /** Relation id as read from this item. */
  relation: string
  /** Shown text; a derived edge may carry its own word. */
  label: string
  direction: EdgeDirection
  /** This item's own link (draft), when there is one. */
  outLinkId?: string
  /** The other item's link pointing here, when there is one. */
  inLink?: { sourceId: string; linkId: string; relation: string }
  family: string
  /** Where a derived edge came from, e.g. "relation-field". */
  derivedFrom?: string
}

/** The same key from both ends of a pair: the smaller of a relation and its inverse. */
export function canonicalRelation(relation: string): string {
  const inverse = inverseRelation(relation)
  return inverse < relation ? inverse : relation
}

export function edgeKey(otherId: string, relation: string): string {
  return `${otherId}|${canonicalRelation(relation)}`
}

export function egoEdges(
  item: Pick<Task, "id" | "links">,
  all: ItemRecord[],
  derived: readonly EgoEdge[] = [],
): EgoEdge[] {
  const byKey = new Map<string, EgoEdge>()
  const index = taskIndexOf(all)
  for (const link of item.links ?? []) {
    if (!link.targetId || link.targetId === item.id) continue
    const key = edgeKey(link.targetId, link.relation)
    if (byKey.has(key)) continue
    byKey.set(key, {
      key,
      otherId: link.targetId,
      relation: link.relation,
      label: relationLabel(link.relation),
      direction: "out",
      outLinkId: link.id,
      family: relationFamily(link.relation),
    })
  }
  for (const source of index.backlinks.get(item.id) ?? []) {
    if (source.id === item.id) continue
    for (const link of source.links ?? []) {
      if (link.targetId !== item.id) continue
      const read = inverseRelation(link.relation)
      const key = edgeKey(source.id, read)
      const inLink = { sourceId: source.id, linkId: link.id, relation: link.relation }
      const existing = byKey.get(key)
      if (existing) {
        if (existing.direction === "out") byKey.set(key, { ...existing, direction: "mutual", inLink })
        continue
      }
      byKey.set(key, {
        key,
        otherId: source.id,
        relation: read,
        label: relationLabel(read),
        direction: "in",
        inLink,
        family: relationFamily(read),
      })
    }
  }
  for (const edge of derived) {
    if (byKey.has(edge.key)) continue
    // A real edge to the same person in the same family already says it.
    byKey.set(edge.key, edge)
  }
  return [...byKey.values()]
}

/** Items the neighbors link to (second ring), not this item or the neighbors. */
export function secondRing(
  itemId: string,
  edges: readonly EgoEdge[],
  all: ItemRecord[],
  limit = 24,
): { from: string; to: string; relation: string }[] {
  const index = taskIndexOf(all)
  const near = new Set([itemId, ...edges.map((e) => e.otherId)])
  const out: { from: string; to: string; relation: string }[] = []
  const seen = new Set<string>()
  for (const edge of edges) {
    const other = index.byId.get(edge.otherId)
    for (const link of other?.links ?? []) {
      if (near.has(link.targetId) || seen.has(link.targetId) || !index.byId.has(link.targetId)) continue
      seen.add(link.targetId)
      out.push({ from: edge.otherId, to: link.targetId, relation: link.relation })
      if (out.length >= limit) return out
    }
  }
  return out
}

/** Counts for the Links tab key. */
export function edgeCount(edges: readonly EgoEdge[]): number {
  return edges.filter((e) => e.direction !== "derived").length
}
