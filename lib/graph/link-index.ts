/**
 * lib/graph/link-index.ts — Steps out of one item, read from that item.
 *
 * Pure. An out link reads as `link.relation`; a link another item points
 * here reads through `inverseRelation`. Backlinks come from `taskIndexOf`
 * (cached by tasks array identity), so a walk costs the item's degree, not
 * the vault (invariant 11).
 */
import { inverseRelation } from "@/lib/links"
import { taskIndexOf } from "@/lib/task-index"
import type { ItemRecord } from "@/lib/types"

export interface LinkStep {
  from: string
  relation: string
  to: string
  linkId?: string
  /** Incoming steps: the relation as stored on the other item (`to` → `from`). */
  stored?: string
}

/** The step read from the other end: what `to` says about `from`. */
export function factFromOther(s: LinkStep, inverse: (r: string) => string): string {
  return s.stored ?? inverse(s.relation)
}

export interface LinkIndex {
  byId: Map<string, ItemRecord>
  /** Every step out of `id`, both stored directions. */
  steps(id: string): LinkStep[]
  /** Distinct neighbour ids. */
  neighbours(id: string): Set<string>
}

const cache = new WeakMap<readonly ItemRecord[], LinkIndex>()

/** `override` swaps in a draft for its saved copy (the open item). */
export function linkIndexOf(all: readonly ItemRecord[], override?: Pick<ItemRecord, "id" | "links">): LinkIndex {
  if (!override) {
    const hit = cache.get(all)
    if (hit) return hit
  }
  const index = taskIndexOf(all as ItemRecord[])
  const memo = new Map<string, LinkStep[]>()
  const outOf = (id: string) => (override && id === override.id ? override.links : index.byId.get(id)?.links) ?? []
  const steps = (id: string): LinkStep[] => {
    const known = memo.get(id)
    if (known) return known
    const out: LinkStep[] = []
    for (const link of outOf(id)) {
      if (link?.targetId && link.relation && link.targetId !== id) out.push({ from: id, relation: link.relation, to: link.targetId, linkId: link.id })
    }
    const seen = new Set<string>()
    for (const source of index.backlinks.get(id) ?? []) {
      if (source.id === id || seen.has(source.id)) continue
      seen.add(source.id)
      const links = override && source.id === override.id ? override.links ?? [] : source.links ?? []
      for (const link of links) {
        if (link?.targetId === id && link.relation) out.push({ from: id, relation: inverseRelation(link.relation), to: source.id, linkId: link.id, stored: link.relation })
      }
    }
    // A draft link to an item with no saved backlink yet.
    if (override && id !== override.id) {
      for (const link of override.links ?? []) {
        if (link?.targetId === id && link.relation && !out.some((s) => s.linkId === link.id)) {
          out.push({ from: id, relation: inverseRelation(link.relation), to: override.id, linkId: link.id, stored: link.relation })
        }
      }
    }
    memo.set(id, out)
    return out
  }
  const result: LinkIndex = {
    byId: index.byId,
    steps,
    neighbours: (id) => new Set(steps(id).map((s) => s.to)),
  }
  if (!override) cache.set(all, result)
  return result
}
