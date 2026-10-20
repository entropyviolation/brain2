/** Densify source: open triads, scored by Adamic–Adar over shared neighbours. */
import { suggestion, type SuggestionSourceFn } from "@/lib/graph/densify"

export const triadSource: SuggestionSourceFn = (item, ctx) => {
  const mine = ctx.links.neighbours(item.id)
  const score = new Map<string, { aa: number; via: string[] }>()
  for (const z of mine) {
    const zn = ctx.links.neighbours(z)
    const weight = 1 / Math.log(Math.max(2, zn.size) + 1)
    for (const c of zn) {
      if (c === item.id || mine.has(c)) continue
      const row = score.get(c) ?? { aa: 0, via: [] }
      row.aa += weight
      row.via.push(z)
      score.set(c, row)
    }
  }
  const out = []
  for (const [c, { aa, via }] of score) {
    if (via.length < 2) continue
    const names = via.slice(0, 2).map(ctx.title).join(" and ")
    const more = via.length > 2 ? ` and ${via.length - 2} more` : ""
    out.push(suggestion(c, "related", "triad", `${ctx.title(c)} links to ${names}${more}, who both link here`, aa / (aa + 1)))
  }
  return out
}
