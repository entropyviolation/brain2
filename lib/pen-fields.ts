/**
 * lib/pen-fields.ts — Detail fields a pen (or a tag) asks every block for
 *
 * The block editor used to show Project / context, Book(s), and Pages read on
 * every Activity block. Now a pen owns its fields: Reading asks for Book(s)
 * (text) and Pages read (number); a pen with the Work tag asks for Project /
 * context because the tag carries that field. Fields are declared in pen
 * settings and tag settings; values live on the block.
 *
 * - `TrackPen.fields` / `TrackTag.fields`: `PenField[]`. A tag with no `fields`
 *   key that is the Work tag (`tag-work` or named Work) carries Project / context
 *   built in. An empty list turns that off.
 * - `TimeEntry.fieldValues`: values by field id. The three original fields keep
 *   their ids (`project`, `books`, `pages`) and are mirrored onto the legacy
 *   `entry.project` / `books` / `pages` so search and older readers still work;
 *   a legacy value with no field declaring it still shows in the editor (kept).
 * - Number fields can feed a habit (`HabitTrackingLink.fieldId`) and every field
 *   is a Done-today template variable (`{pages}`, `{books}`, `{book(s)}`, …).
 *
 * Pure; structural types only.
 */

export type PenFieldKind = "text" | "number"

export interface PenField {
  id: string
  name: string
  kind: PenFieldKind
  /** Shown after a number, e.g. "pages". */
  unit?: string
}

export type FieldValue = string | number
export type FieldValues = Record<string, FieldValue>

export const PROJECT_FIELD: PenField = { id: "project", name: "Project / context", kind: "text" }
export const BOOKS_FIELD: PenField = { id: "books", name: "Book(s)", kind: "text" }
export const PAGES_FIELD: PenField = { id: "pages", name: "Pages read", kind: "number", unit: "pages" }

/** Offered first when adding a field; picking one reuses its id so old values show. */
export const FIELD_PRESETS: PenField[] = [PROJECT_FIELD, BOOKS_FIELD, PAGES_FIELD]

const LEGACY_IDS = new Set(["project", "books", "pages"])

type FieldTag = { id: string; name: string; fields?: PenField[] }
type FieldPen = { id: string; name: string; tags?: string[]; fields?: PenField[] }
type FieldEntry = {
  fieldValues?: FieldValues
  project?: string
  books?: string
  pages?: number
  tagIds?: string[]
}

export function isWorkTag(tag: { id: string; name: string }): boolean {
  return tag.id === "tag-work" || tag.name.trim().toLowerCase() === "work"
}

export function tagFields(tag: FieldTag): PenField[] {
  if (tag.fields) return tag.fields
  return isWorkTag(tag) ? [PROJECT_FIELD] : []
}

export type BlockField = {
  field: PenField
  /** Where the field comes from: a pen, a tag, or an old value no field declares. */
  source: "pen" | "tag" | "kept"
  sourceName: string
}

/** The fields a block asks for: its pens' own, then its tags', then kept legacy values. */
export function fieldsForBlock(pens: FieldPen[], tags: FieldTag[], entry?: FieldEntry): BlockField[] {
  const out: BlockField[] = []
  const seen = new Set<string>()
  const push = (field: PenField, source: BlockField["source"], sourceName: string) => {
    if (seen.has(field.id)) return
    seen.add(field.id)
    out.push({ field, source, sourceName })
  }
  for (const pen of pens) for (const field of pen.fields ?? []) push(field, "pen", pen.name)
  const tagIds = new Set([...pens.flatMap((pen) => pen.tags ?? []), ...(entry?.tagIds ?? [])])
  for (const tag of tags) if (tagIds.has(tag.id)) for (const field of tagFields(tag)) push(field, "tag", tag.name)
  if (entry) {
    for (const field of FIELD_PRESETS) {
      const value = entryFieldValue(entry, field.id)
      if (value !== undefined && value !== "") push(field, "kept", "earlier value")
    }
    for (const [id, value] of Object.entries(entry.fieldValues ?? {})) {
      if (seen.has(id) || value === "") continue
      push({ id, name: id, kind: typeof value === "number" ? "number" : "text" }, "kept", "earlier value")
    }
  }
  return out
}

export function entryFieldValue(entry: FieldEntry, fieldId: string): FieldValue | undefined {
  const own = entry.fieldValues?.[fieldId]
  if (own !== undefined) return own
  if (fieldId === "project") return entry.project
  if (fieldId === "books") return entry.books
  if (fieldId === "pages") return entry.pages
  return undefined
}

export function parseFieldInput(field: PenField, text: string): FieldValue | undefined {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  if (field.kind === "number") {
    const n = Number.parseFloat(trimmed.replace(/,/g, ""))
    return Number.isFinite(n) ? n : undefined
  }
  return trimmed
}

export function fieldInputText(value: FieldValue | undefined): string {
  return value === undefined ? "" : String(value)
}

/**
 * The patch for a block's field values. Legacy ids mirror onto the old props;
 * an emptied field clears both.
 */
export function fieldValuesPatch(values: Record<string, FieldValue | undefined>): {
  fieldValues?: FieldValues
  project?: string
  books?: string
  pages?: number
} {
  const fieldValues: FieldValues = {}
  for (const [id, value] of Object.entries(values)) {
    if (value === undefined || value === "") continue
    if (!LEGACY_IDS.has(id)) fieldValues[id] = value
  }
  const text = (value: FieldValue | undefined) => (value === undefined || value === "" ? undefined : String(value))
  const pages = values.pages
  const pageNumber = typeof pages === "number" ? pages : typeof pages === "string" ? Number.parseFloat(pages) : NaN
  return {
    fieldValues: Object.keys(fieldValues).length ? fieldValues : undefined,
    project: text(values.project),
    books: text(values.books),
    pages: Number.isFinite(pageNumber) ? Math.round(pageNumber) : undefined,
  }
}

/** Same values, ignoring key order. */
export function sameFieldValues(a: FieldValues | undefined, b: FieldValues | undefined): boolean {
  const ka = Object.keys(a ?? {})
  const kb = Object.keys(b ?? {})
  if (ka.length !== kb.length) return false
  return ka.every((key) => (a ?? {})[key] === (b ?? {})[key])
}

/** Template keys for a field: its id, its lowercased name, and the name with only letters and digits. */
export function fieldVariableKeys(field: PenField): string[] {
  const lower = field.name.trim().toLowerCase()
  const bare = lower.replace(/[^a-z0-9]+/g, "")
  return [...new Set([field.id.toLowerCase(), lower, bare].filter(Boolean))]
}

export function makeFieldId(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24)
  return `fld-${slug || "field"}-${Math.random().toString(36).slice(2, 6)}`
}

/** Every number field declared anywhere (pens, then tags), first declaration wins. */
export function numberFieldsIn(scopes: { pens: FieldPen[] }[], tags: FieldTag[]): PenField[] {
  const out = new Map<string, PenField>()
  for (const scope of scopes) for (const pen of scope.pens) for (const field of pen.fields ?? []) if (field.kind === "number" && !out.has(field.id)) out.set(field.id, field)
  for (const tag of tags) for (const field of tagFields(tag)) if (field.kind === "number" && !out.has(field.id)) out.set(field.id, field)
  return [...out.values()]
}

/** Numeric value of a field on a block, or 0. */
export function numericFieldValue(entry: FieldEntry, fieldId: string): number {
  const value = entryFieldValue(entry, fieldId)
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const n = Number.parseFloat(value)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}
