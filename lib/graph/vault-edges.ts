/**
 * lib/graph/vault-edges.ts — Recorded edges that are not the day spine.
 *
 * A read-only projection. `Item.links`, `Task.dependencies`, and
 * `List.linkedTargetListIds` become triples. Nothing is written onto items.
 * Every edge here is `recorded`. Derived edges stay out (no inverses, no
 * membership expansion, no period nesting).
 *
 * `VaultTriple` is imported as a type only, so this module does not load
 * the spine projector in `vault-graph.ts`.
 */
import type { VaultTriple } from "@/lib/graph/vault-graph"
import { linkedTargetIds } from "@/lib/list-links"
import type { List } from "@/lib/types"

export type EdgeTriple = Pick<VaultTriple, "s" | "p" | "o" | "graph" | "order">

export interface VaultEdgeItem {
  id: string
  links?: readonly { relation?: string; targetId?: string }[] | null
  dependencies?: readonly string[] | null
}

export interface VaultEdgeList {
  id: string
  linkedTargetListIds?: readonly string[] | null
}

const RECORDED = "recorded" as const

function address(kind: "item" | "list", id: string): string {
  const prefix = `${kind}:`
  return id.startsWith(prefix) ? id : `${prefix}${id}`
}

/** Project recorded item, dependency, and list edges. Omitting `lists` skips list edges. */
export function projectVaultEdges(input: {
  items: readonly VaultEdgeItem[]
  lists?: readonly VaultEdgeList[]
}): EdgeTriple[] {
  const triples: EdgeTriple[] = []
  const seen = new Set<string>()
  const push = (triple: EdgeTriple) => {
    const key = `${triple.s}|${triple.p}|${triple.o}|${triple.graph}`
    if (seen.has(key)) return
    seen.add(key)
    triples.push(triple)
  }

  for (const item of input.items) {
    if (!item?.id) continue
    const source = address("item", item.id)
    for (const link of item.links ?? []) {
      const relation = link?.relation?.trim()
      const targetId = link?.targetId?.trim()
      if (!relation || !targetId || targetId === item.id) continue
      push({ s: source, p: relation, o: address("item", targetId), graph: "links", order: RECORDED })
    }
    for (const depId of item.dependencies ?? []) {
      const targetId = depId?.trim()
      if (!targetId || targetId === item.id) continue
      push({ s: source, p: "depends-on", o: address("item", targetId), graph: "dependencies", order: RECORDED })
    }
  }

  if (input.lists) {
    for (const list of input.lists) {
      if (!list?.id) continue
      const targets = linkedTargetIds({ id: list.id, linkedTargetListIds: [...(list.linkedTargetListIds ?? [])] } as List)
      for (const targetId of targets) {
        push({ s: address("list", list.id), p: "linked-list", o: address("list", targetId), graph: "lists", order: RECORDED })
      }
    }
  }

  return triples
}
