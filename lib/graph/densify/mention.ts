/**
 * Densify source: a name written on this item.
 *
 * Every item is matched by its full title (notes, note log, description, body,
 * and other text). A close person (`personProfile.close`) is also matched by
 * first name and nickname. One person, one row: several records with the same
 * name collapse, and a close person wins. A hit in the title is the one the
 * Links tab writes; the rest stay on the shelf.
 */
import { getRelationDef } from "@/lib/relation-registry"
import { suggestion, type DensifyContext, type Suggestion, type SuggestionSourceFn } from "@/lib/graph/densify"
import type { ItemRecord } from "@/lib/types"

const MIN_TITLE = 3
const MIN_ALIAS = 2

interface NameHit {
  otherId: string
  relation: string
  field: string
  when?: string
  sentence: string
  span: string
  /** Matched alias, lowercased. Several records of this name become one row. */
  nameKey: string
  close: boolean
}

function sentenceAt(text: string, at: number, length: number): string {
  let start = 0
  for (let i = at - 1; i >= 0; i--) {
    const c = text[i]
    if (c === "\n" || c === "." || c === "!" || c === "?") {
      start = i + 1
      break
    }
  }
  let end = text.length
  for (let i = at + length; i < text.length; i++) {
    const c = text[i]
    if (c === "\n" || c === "." || c === "!" || c === "?") {
      end = c === "\n" ? i : i + 1
      break
    }
  }
  let sentence = text.slice(start, end).replace(/\s+/g, " ").trim()
  if (sentence.length > 180) sentence = `${sentence.slice(0, 177)}…`
  return sentence
}

function token(value: string | undefined): string | undefined {
  const word = value?.trim().split(/\s+/)[0]?.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
  if (!word || word.length < MIN_ALIAS) return undefined
  return word
}

function isClose(item: ItemRecord): boolean {
  return item.personProfile?.close === true
}

/** Full title for anyone. First name and nicknames only when the person is close. */
function aliases(item: ItemRecord, title: string): string[] {
  const names = new Set<string>()
  if (title.length >= MIN_TITLE && title !== "Untitled") names.add(title)
  if (!isClose(item)) return [...names]
  const first = token(title) ?? token(item.personProfile?.fullName)
  if (first) names.add(first)
  const fromFull = token(item.personProfile?.fullName)
  if (fromFull) names.add(fromFull)
  for (const nick of item.personProfile?.nicknames ?? []) {
    const cleaned = nick.trim()
    if (cleaned.length >= MIN_ALIAS) names.add(cleaned)
  }
  return [...names]
}

function textsOf(item: ItemRecord): { field: string; text: string; when?: string }[] {
  const texts: { field: string; text: string; when?: string }[] = []
  if (item.title?.trim()) texts.push({ field: "title", text: item.title })
  if (item.description?.trim() && item.description.trim() !== item.title?.trim()) texts.push({ field: "description", text: item.description })
  if (item.body?.trim()) texts.push({ field: "body", text: item.body })
  if (item.notes?.trim()) texts.push({ field: "notes", text: item.notes })
  for (const entry of item.noteLog ?? []) {
    if (entry?.text?.trim()) texts.push({ field: "noteLog", text: entry.text, when: entry.date })
  }
  for (const [key, value] of Object.entries(item.attributes ?? {})) {
    if (typeof value === "string" && value.trim()) texts.push({ field: `attributes.${key}`, text: value })
    else if (Array.isArray(value)) {
      const joined = value.filter((part): part is string => typeof part === "string" && part.trim().length > 0).join("\n")
      if (joined) texts.push({ field: `attributes.${key}`, text: joined })
    }
  }
  return texts
}

function whereOf(field: string, when?: string): string {
  if (field === "title") return "the title"
  if (field === "description") return "the description"
  if (field === "body") return "the body"
  if (field === "notes") return "the notes"
  if (field === "noteLog") return when ? `the ${when} note` : "a note"
  if (field.startsWith("attributes.")) return `the ${field.slice("attributes.".length)} field`
  return "the text"
}

function relationFor(otherId: string, ctx: DensifyContext): string {
  const preferred = getRelationDef("mentioned") ? "mentioned" : "related"
  if (!ctx.scopeOk || ctx.scopeOk(preferred, otherId)) return preferred
  if (ctx.scopeOk("related", otherId)) return "related"
  return ""
}

function better(next: NameHit, prev: NameHit): boolean {
  if (next.close !== prev.close) return next.close
  if ((next.field === "title") !== (prev.field === "title")) return next.field === "title"
  return false
}

export const mentionSource: SuggestionSourceFn = (item, ctx) => {
  const texts = textsOf(item)
  if (!texts.length) return []
  const byName = new Map<string, NameHit>()
  for (const other of ctx.all) {
    if (other.id === item.id) continue
    const title = ctx.title(other.id).trim()
    const names = aliases(other, title)
    if (!names.length) continue
    const relation = relationFor(other.id, ctx)
    if (!relation) continue
    let hit: NameHit | null = null
    for (const name of names) {
      const re = new RegExp(`(^|[^\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "iu")
      for (const text of texts) {
        const found = re.exec(text.text)
        if (!found) continue
        const at = found.index + found[1].length
        const candidate: NameHit = {
          otherId: other.id,
          relation,
          field: text.field,
          when: text.when,
          sentence: sentenceAt(text.text, at, name.length),
          span: text.text.slice(Math.max(0, at - 20), at + name.length + 20),
          nameKey: name.toLowerCase(),
          close: isClose(other),
        }
        if (!hit || better(candidate, hit)) hit = candidate
        break
      }
    }
    if (!hit) continue
    const prev = byName.get(hit.nameKey)
    if (!prev || better(hit, prev)) byName.set(hit.nameKey, hit)
  }
  const out: Suggestion[] = []
  for (const hit of byName.values()) {
    const where = whereOf(hit.field, hit.when)
    out.push(
      suggestion(hit.otherId, hit.relation, "mention", `Named in ${where}: "${hit.sentence}"`, hit.field === "title" ? 1 : 0.9, {
        itemId: item.id,
        field: hit.field,
        span: hit.span,
      }),
    )
  }
  return out
}
