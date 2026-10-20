/** Densify source: items sharing two or more rare lists or tags (IDF-weighted Jaccard). */
import { normalizeTag } from "@/lib/links"
import { suggestion, type SuggestionSourceFn } from "@/lib/graph/densify"
import type { ItemRecord } from "@/lib/types"

const RARE = 25

function marks(item: ItemRecord): string[] {
  return [...(item.lists ?? []).map((l) => `list:${l}`), ...(item.tags ?? []).map((t) => `tag:${normalizeTag(t)}`)]
}

let source: readonly ItemRecord[] | null = null
let byMark = new Map<string, ItemRecord[]>()

function marksIndex(all: readonly ItemRecord[]) {
  if (source === all) return byMark
  source = all
  byMark = new Map()
  for (const it of all) for (const m of marks(it)) (byMark.get(m) ?? byMark.set(m, []).get(m)!).push(it)
  return byMark
}

export const coMemberSource: SuggestionSourceFn = (item, ctx) => {
  const index = marksIndex(ctx.all)
  const mine = marks(item)
  const shared = new Map<string, string[]>()
  let total = 0
  for (const m of mine) {
    const members = index.get(m) ?? []
    if (members.length > RARE) continue
    total += 1 / Math.log(members.length + 1)
    for (const other of members) if (other.id !== item.id) (shared.get(other.id) ?? shared.set(other.id, []).get(other.id)!).push(m)
  }
  const out = []
  for (const [id, ms] of shared) {
    if (ms.length < 2) continue
    const w = ms.reduce((sum, m) => sum + 1 / Math.log((index.get(m)?.length ?? 1) + 1), 0)
    const names = ms.slice(0, 2).map((m) => (m.startsWith("tag:") ? `#${m.slice(4)}` : `a shared list`)).join(" and ")
    out.push(suggestion(id, "related", "co-member", `Both on ${names}`, total ? w / total : 0))
  }
  return out
}
