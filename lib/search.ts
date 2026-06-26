/**
 * lib/search.ts — Pure, framework-free ranked item search.
 *
 * A dependency-free, deterministic search over the unified `Item`/`Task` model
 * (lib/types.ts). It powers the global command-palette search (Phase 6a) but is
 * intentionally decoupled from React, Zustand, and the data repository so it can
 * be unit-tested in isolation and reused anywhere (services, future MongoDB
 * full-text fallbacks, etc.).
 *
 * Ranking model (high → low):
 *   1. Title / description match  (the canonical display label)
 *   2. Tag match
 *   3. Attribute / notes / other free-text match
 *
 * Queries are case-insensitive and split on whitespace into terms that are
 * combined with AND semantics: every term must match *somewhere* on an item for
 * it to be a result. An item's score is the sum, over each term, of the highest-
 * weighted field that term matched. Field-position bonuses (exact title, title
 * prefix, whole-word) break ties so the most relevant items float to the top.
 *
 * Determinism: results are stably ordered by score (desc), then title (asc),
 * then id (asc) so the same inputs always produce the same ordering.
 */
import type { Item, Task, AttributeValue } from "@/lib/types"

/** The field category a query term matched on, ordered by descending weight. */
export type SearchField = "title" | "tag" | "attribute"

/** A single ranked search hit. */
export interface SearchResult<T extends Item = Item> {
  /** The matched item. */
  item: T
  /** Relevance score (higher is more relevant). Always > 0 for a hit. */
  score: number
  /** Distinct field categories that contributed to the match, best-first. */
  matchedOn: SearchField[]
}

export interface SearchOptions {
  /** Cap the number of results returned (after ranking). Default: unlimited. */
  limit?: number
  /**
   * When true, only the title/description field is searched (tags, notes, and
   * other free-text attributes are ignored). Default: false (search all text).
   */
  titleOnly?: boolean
}

/** Relative importance of each searchable field category. */
const FIELD_WEIGHT: Record<SearchField, number> = {
  title: 100,
  tag: 40,
  attribute: 10,
}

/** Position bonuses (added on top of the field weight) for stronger matches. */
const EXACT_BONUS = 50
const PREFIX_BONUS = 20
const WORD_BOUNDARY_BONUS = 10

interface FieldText {
  field: SearchField
  text: string
}

/** Lowercase + collapse whitespace so matching is case/whitespace-insensitive. */
function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim()
}

/** Split a raw query into normalized, non-empty terms (AND-combined). */
function tokenize(query: string): string[] {
  return normalize(query)
    .split(" ")
    .filter((t) => t.length > 0)
}

function isFileValue(v: unknown): v is { name?: string; extractedText?: string } {
  return typeof v === "object" && v !== null && "uri" in v && "mime" in v
}

function stringifyAttributeValue(value: AttributeValue): string {
  if (value == null) return ""
  if (Array.isArray(value)) {
    return value.map((v) => (isFileValue(v) ? [v.name, v.extractedText].filter(Boolean).join(" ") : v)).join(" ")
  }
  if (typeof value === "object") {
    if (isFileValue(value)) return [value.name, value.extractedText].filter(Boolean).join(" ")
    // GoalValue { current, target }
    return `${value.current ?? ""} ${value.target ?? ""}`
  }
  return String(value)
}

/**
 * Collect the searchable text of an item, grouped by field category. Works for
 * the generic `Item` and the richer built-in `Task` (description, notes, etc.).
 */
function collectFields(item: Item, titleOnly = false): FieldText[] {
  const task = item as Partial<Task>
  const fields: FieldText[] = []

  const titleText = [item.title, task.description].filter(Boolean).join(" ")
  if (titleText) fields.push({ field: "title", text: normalize(titleText) })

  if (titleOnly) return fields

  if (item.tags?.length) {
    for (const tag of item.tags) {
      const t = normalize(tag)
      if (t) fields.push({ field: "tag", text: t })
    }
  }

  const attrTexts: string[] = []
  if (task.notes) attrTexts.push(task.notes)
  if (task.taskDescription) attrTexts.push(task.taskDescription)
  if (task.why) attrTexts.push(task.why)
  if (task.consequences) attrTexts.push(task.consequences)
  if (task.context) attrTexts.push(task.context)
  if (item.attributes) {
    for (const value of Object.values(item.attributes)) {
      const s = stringifyAttributeValue(value)
      if (s) attrTexts.push(s)
    }
  }
  for (const text of attrTexts) {
    const n = normalize(text)
    if (n) fields.push({ field: "attribute", text: n })
  }

  return fields
}

/** Score one term against one field's text. Returns 0 when the term is absent. */
function scoreTermInField(term: string, fieldText: FieldText): number {
  const { field, text } = fieldText
  const idx = text.indexOf(term)
  if (idx === -1) return 0

  let score = FIELD_WEIGHT[field]
  if (text === term) {
    score += EXACT_BONUS
  } else if (idx === 0) {
    score += PREFIX_BONUS
  } else if (text[idx - 1] === " ") {
    score += WORD_BOUNDARY_BONUS
  }
  return score
}

/**
 * Search `items` for `query`, returning ranked `SearchResult`s (best first).
 *
 * - Case-insensitive; multi-term queries are AND-combined (every term must hit).
 * - An empty/whitespace-only query returns `[]`.
 * - Pure & deterministic: no I/O, no globals, stable tie-breaking.
 */
export function searchItems<T extends Item>(
  query: string,
  items: readonly T[],
  opts: SearchOptions = {}
): SearchResult<T>[] {
  const terms = tokenize(query)
  if (terms.length === 0) return []

  const results: SearchResult<T>[] = []

  for (const item of items) {
    const fields = collectFields(item, opts.titleOnly)
    if (fields.length === 0) continue

    let total = 0
    const matched = new Set<SearchField>()
    let allTermsMatched = true

    for (const term of terms) {
      let bestForTerm = 0
      let bestField: SearchField | null = null
      for (const fieldText of fields) {
        const s = scoreTermInField(term, fieldText)
        if (s > bestForTerm) {
          bestForTerm = s
          bestField = fieldText.field
        }
      }
      if (bestForTerm === 0) {
        allTermsMatched = false
        break
      }
      total += bestForTerm
      if (bestField) matched.add(bestField)
    }

    if (!allTermsMatched) continue

    results.push({
      item,
      score: total,
      matchedOn: orderFields(matched),
    })
  }

  results.sort(compareResults)

  return opts.limit != null ? results.slice(0, Math.max(0, opts.limit)) : results
}

const FIELD_ORDER: SearchField[] = ["title", "tag", "attribute"]

/** Return matched field categories in canonical best-first order. */
function orderFields(matched: Set<SearchField>): SearchField[] {
  return FIELD_ORDER.filter((f) => matched.has(f))
}

/** Stable comparator: score desc, then title asc, then id asc. */
function compareResults(a: SearchResult, b: SearchResult): number {
  if (b.score !== a.score) return b.score - a.score
  const at = displayTitle(a.item)
  const bt = displayTitle(b.item)
  if (at !== bt) return at < bt ? -1 : 1
  return a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0
}

/** Best-effort display label for an item (title, else description, else id). */
export function displayTitle(item: Item): string {
  const task = item as Partial<Task>
  return item.title || task.description || item.id
}
