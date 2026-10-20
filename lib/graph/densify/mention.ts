/** Densify source: another item's title named in this item's notes or note log. */
import { getRelationDef } from "@/lib/relation-registry"
import { suggestion, type SuggestionSourceFn } from "@/lib/graph/densify"

const MIN_TITLE = 3

export const mentionSource: SuggestionSourceFn = (item, ctx) => {
  const texts: { field: string; text: string; when?: string }[] = []
  if (item.notes) texts.push({ field: "notes", text: item.notes })
  for (const entry of item.noteLog ?? []) {
    if (entry?.text) texts.push({ field: "noteLog", text: entry.text, when: entry.date })
  }
  if (!texts.length) return []
  const relation = getRelationDef("mentions") ? "mentions" : "related"
  const out = []
  for (const other of ctx.all) {
    if (other.id === item.id) continue
    const title = ctx.title(other.id).trim()
    if (title.length < MIN_TITLE || title === "Untitled") continue
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "iu")
    for (const t of texts) {
      const m = re.exec(t.text)
      if (!m) continue
      const at = m.index + m[1].length
      const span = t.text.slice(Math.max(0, at - 20), at + title.length + 20)
      const where = t.field === "notes" ? "the notes" : t.when ? `the ${t.when} note` : "a note"
      out.push(suggestion(other.id, relation, "mention", `Named in ${where}`, 1, { itemId: item.id, field: t.field, span }))
      break
    }
  }
  return out
}
