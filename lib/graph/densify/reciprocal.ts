/**
 * Densify source: in-only edges on ask/expect relations → offer the inverse.
 * Symmetric relations are skipped: one stored link already says it both ways.
 */
import { getRelationDef } from "@/lib/relation-registry"
import { inverseRelationLabel } from "@/lib/links"
import { suggestion, type SuggestionSourceFn } from "@/lib/graph/densify"

export const reciprocalSource: SuggestionSourceFn = (item, ctx) => {
  const out = new Set((item.links ?? []).map((l) => l.targetId))
  return ctx.links
    .steps(item.id)
    .filter((s) => !out.has(s.to))
    .filter((s) => {
      const def = getRelationDef(s.relation)
      if (s.stored && (def?.inverse ?? s.relation) === s.relation && s.stored === s.relation) return false
      return (def?.reciprocity ?? "ask") !== "quiet"
    })
    .map((s) => {
      const stored = getRelationDef(s.relation)?.inverse ?? s.relation
      return suggestion(s.to, s.relation, "reciprocal", `${ctx.title(s.to)} says: ${inverseRelationLabel(s.relation) || stored} ${ctx.title(item.id)}`, 0.9)
    })
}
