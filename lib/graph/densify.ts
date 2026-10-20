/**
 * lib/graph/densify.ts — Where new edges come from (LINKS_REDESIGN §10, L4.1).
 *
 * Pure. Each source is `(item, ctx) => Suggestion[]`. `mergeSuggestions`
 * drops dismissed keys, existing edges, out-of-scope relations, rows with no
 * reason, and muted sources; keeps the best per other item; returns the top
 * five. A score orders the shelf. It never decides anything.
 */
import { edgeKey } from "@/lib/link-graph"
import type { LinkIndex } from "@/lib/graph/link-index"
import type { ItemRecord } from "@/lib/types"

export type SuggestionSource = "reciprocal" | "rule" | "triad" | "co-member" | "mention" | "relation-word" | "co-time" | "proposal"

export const SUGGESTION_SOURCES: SuggestionSource[] = ["reciprocal", "rule", "triad", "co-member", "mention", "relation-word", "co-time", "proposal"]

export const SHELF_SIZE = 5

export interface Suggestion {
  key: string
  otherId: string
  relation: string
  source: SuggestionSource
  reason: string
  evidence?: { itemId: string; field: string; span: string }
  /** In [0, 1]. */
  score: number
}

export interface DensifyContext {
  all: readonly ItemRecord[]
  links: LinkIndex
  title: (id: string) => string
  /** Whether `relation` may run from `item` to `otherId`. */
  scopeOk?: (relation: string, otherId: string) => boolean
}

export type SuggestionSourceFn = (item: ItemRecord, ctx: DensifyContext) => Suggestion[]

export function suggestion(otherId: string, relation: string, source: SuggestionSource, reason: string, score: number, evidence?: Suggestion["evidence"]): Suggestion {
  return { key: edgeKey(otherId, relation), otherId, relation, source, reason, score: Math.max(0, Math.min(1, score)), ...(evidence ? { evidence } : {}) }
}

export function mergeSuggestions(
  item: Pick<ItemRecord, "id" | "dismissedLinkSuggestions">,
  lists: readonly Suggestion[][],
  opts: { links: LinkIndex; muted?: readonly string[]; scopeOk?: (relation: string, otherId: string) => boolean; limit?: number },
): Suggestion[] {
  const dismissed = new Set(item.dismissedLinkSuggestions ?? [])
  const muted = new Set(opts.muted ?? [])
  const linked = opts.links.neighbours(item.id)
  const best = new Map<string, Suggestion>()
  for (const list of lists) {
    for (const s of list) {
      if (!s.reason?.trim() || s.otherId === item.id || muted.has(s.source) || dismissed.has(s.key)) continue
      if (s.source !== "reciprocal" && linked.has(s.otherId)) continue
      if (opts.scopeOk && !opts.scopeOk(s.relation, s.otherId)) continue
      const prev = best.get(s.otherId)
      if (!prev || s.score > prev.score) best.set(s.otherId, s)
    }
  }
  return [...best.values()]
    .sort((a, b) => b.score - a.score || (a.key < b.key ? -1 : 1))
    .slice(0, opts.limit ?? SHELF_SIZE)
}
