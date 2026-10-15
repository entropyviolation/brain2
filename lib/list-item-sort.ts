/**
 * lib/list-item-sort.ts — Default-view row order and in-list search
 *
 * Sort: `List.defaultView.sort` ({ key, dir }). `custom` is the stored order
 * (what every list did before sort existed). Built-in keys read item fields;
 * `attr:<id>` reads a schema attribute, so any trait a list models (mood,
 * energy, source, confidence…) can order its rows. Missing values always sink
 * to the bottom, whatever the direction. Ties keep stored order.
 *
 * Search: one list's caption search (`enhanced-list-view.tsx`). Name only by
 * default; "All fields" also reads description, notes, body, why, consequences,
 * context, tags, subtasks, and every attribute value (file names and their
 * extracted text included).
 */
import { listAddedAt } from "@/lib/list-added-at"
import { itemTitle } from "@/lib/item-utils"
import {
  LIST_ITEM_SORT_BUILTIN_KEYS,
  type AttributeDefinition,
  type AttributeValue,
  type FileValue,
  type GoalValue,
  type ListItemSort,
  type ListItemSortBuiltinKey,
  type ListItemSortDir,
  type ListItemSortKey,
  type Task,
} from "@/lib/types"

export const DEFAULT_LIST_ITEM_SORT: ListItemSort = { key: "custom", dir: "asc" }

export const LIST_ITEM_SORT_LABELS: Record<ListItemSortBuiltinKey, string> = {
  custom: "Custom order",
  added: "Date added to list",
  created: "Date created",
  title: "Name",
  type: "Item type",
  scheduled: "Scheduled date",
  deadline: "Deadline",
  urgency: "Urgency",
  importance: "Importance",
  estimate: "Estimate",
}

/** The direction a key starts in when picked: newest / highest first, names A→Z. */
export function defaultSortDir(key: ListItemSortKey): ListItemSortDir {
  if (key === "added" || key === "created" || key === "urgency" || key === "importance") return "desc"
  return "asc"
}

/** Attribute types that hold an orderable value (not files, images, or computed formulas). */
const SORTABLE_ATTR_TYPES = new Set<AttributeDefinition["type"]>([
  "string",
  "boolean",
  "color",
  "datetime",
  "list",
  "multistring",
  "number",
  "selection",
  "item",
  "link",
  "goal",
])

export function isBuiltinSortKey(value: unknown): value is ListItemSortBuiltinKey {
  return typeof value === "string" && (LIST_ITEM_SORT_BUILTIN_KEYS as readonly string[]).includes(value)
}

export function sortAttrId(key: ListItemSortKey): string | null {
  return key.startsWith("attr:") ? key.slice(5) || null : null
}

export function sanitizeListItemSort(value: unknown): ListItemSort | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  const key = raw.key
  const valid =
    isBuiltinSortKey(key) || (typeof key === "string" && key.startsWith("attr:") && key.length > 5)
  if (!valid) return undefined
  const dir: ListItemSortDir = raw.dir === "desc" ? "desc" : "asc"
  if (key === "custom") return undefined
  return { key: key as ListItemSortKey, dir }
}

export interface ListItemSortOption {
  key: ListItemSortKey
  label: string
  group: "item" | "attribute"
}

/** Built-ins, then this list's sortable attributes (deduped by id, schema order). */
export function listItemSortOptions(defs: readonly AttributeDefinition[]): ListItemSortOption[] {
  const out: ListItemSortOption[] = LIST_ITEM_SORT_BUILTIN_KEYS.map((key) => ({
    key,
    label: LIST_ITEM_SORT_LABELS[key],
    group: "item" as const,
  }))
  const seen = new Set<string>()
  for (const def of defs) {
    if (!def?.id || seen.has(def.id) || !SORTABLE_ATTR_TYPES.has(def.type)) continue
    seen.add(def.id)
    out.push({ key: `attr:${def.id}`, label: def.name || def.id, group: "attribute" })
  }
  return out
}

type SortValue = number | string | null

function dateMs(value: unknown): number | null {
  if (value == null || value === "") return null
  const ms = value instanceof Date ? value.getTime() : new Date(value as string).getTime()
  return Number.isFinite(ms) ? ms : null
}

function isGoal(value: unknown): value is GoalValue {
  return !!value && typeof value === "object" && !Array.isArray(value) && "current" in value && "target" in value
}

function attrSortValue(def: AttributeDefinition | undefined, value: AttributeValue): SortValue {
  if (value == null || value === "") return null
  if (Array.isArray(value)) {
    if (value.length === 0) return null
    const parts = value.map((v) => (typeof v === "string" ? v : (v as FileValue)?.name ?? "")).filter(Boolean)
    return parts.length ? parts.join(", ").toLowerCase() : null
  }
  if (typeof value === "boolean") return value ? 1 : 0
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (isGoal(value)) {
    const target = Number(value.target)
    const current = Number(value.current)
    if (!Number.isFinite(current)) return null
    return Number.isFinite(target) && target !== 0 ? current / target : current
  }
  if (typeof value === "object") return (value as FileValue).name?.toLowerCase() || null
  const text = String(value).trim()
  if (!text) return null
  if (def?.type === "number") {
    const n = Number(text)
    return Number.isFinite(n) ? n : null
  }
  if (def?.type === "datetime" && def.datetimeMode !== "time") return dateMs(text) ?? text.toLowerCase()
  if (def?.type === "selection" && def.optionSource !== "list" && def.options?.length) {
    const idx = def.options.indexOf(text)
    if (idx >= 0) return idx
  }
  return text.toLowerCase()
}

export interface ListItemSortContext {
  /** The open list (for "Date added to list"). Null on All Items views. */
  listId?: string | null
  /** Attribute schema for `attr:` keys (list schema + item-only definitions). */
  defs?: readonly AttributeDefinition[]
  /** Item type display name. */
  typeName?: (task: Task) => string
}

function sortValue(task: Task, key: ListItemSortKey, ctx: ListItemSortContext, defsById: Map<string, AttributeDefinition>): SortValue {
  switch (key) {
    case "added":
      return listAddedAt(task, ctx.listId)
    case "created":
      return dateMs(task.createdAt)
    case "title":
      return itemTitle(task).trim().toLowerCase() || null
    case "type":
      return ctx.typeName ? ctx.typeName(task).toLowerCase() || null : (task.type ?? null)
    case "scheduled":
      return dateMs(task.scheduledDate)
    case "deadline":
      return dateMs(task.deadline)
    case "urgency":
      return typeof task.urgency === "number" ? task.urgency : null
    case "importance":
      return typeof task.importance === "number" ? task.importance : null
    case "estimate":
      return typeof task.estimatedDuration === "number" && task.estimatedDuration > 0 ? task.estimatedDuration : null
    case "custom":
      return null
    default: {
      const id = sortAttrId(key)
      if (!id) return null
      const def = defsById.get(id) ?? task.itemAttributeDefinitions?.find((d) => d.id === id)
      return attrSortValue(def, task.attributes?.[id])
    }
  }
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })

function compareValues(a: SortValue, b: SortValue): number {
  if (typeof a === "number" && typeof b === "number") return a - b
  if (typeof a === "number") return -1
  if (typeof b === "number") return 1
  return collator.compare(String(a), String(b))
}

/**
 * Rows in `sort` order. `custom` / unset returns `tasks` itself. Stable: ties
 * keep stored order. Rows without a value sink to the bottom in both directions.
 */
export function sortListItems(tasks: Task[], sort: ListItemSort | undefined, ctx: ListItemSortContext = {}): Task[] {
  if (!sort || sort.key === "custom" || tasks.length < 2) return tasks
  const defsById = new Map<string, AttributeDefinition>()
  for (const d of ctx.defs ?? []) if (d?.id && !defsById.has(d.id)) defsById.set(d.id, d)
  const sign = sort.dir === "desc" ? -1 : 1
  const keyed = tasks.map((task, index) => ({ task, index, value: sortValue(task, sort.key, ctx, defsById) }))
  keyed.sort((x, y) => {
    const xMissing = x.value == null
    const yMissing = y.value == null
    if (xMissing || yMissing) return xMissing === yMissing ? x.index - y.index : xMissing ? 1 : -1
    return compareValues(x.value, y.value) * sign || x.index - y.index
  })
  return keyed.map((k) => k.task)
}

/* ---------------- In-list search ---------------- */

function pushText(out: string[], value: unknown) {
  if (value == null) return
  if (typeof value === "string") {
    if (value.trim()) out.push(value)
    return
  }
  if (typeof value === "number" || typeof value === "boolean") {
    out.push(String(value))
    return
  }
  if (Array.isArray(value)) {
    for (const v of value) pushText(out, v)
    return
  }
  if (typeof value === "object") {
    const v = value as Partial<FileValue & GoalValue>
    if (typeof v.name === "string") pushText(out, v.name)
    if (typeof v.extractedText === "string") pushText(out, v.extractedText)
    if (typeof v.current === "number") out.push(`${v.current}/${v.target ?? ""}`)
  }
}

/** Every searchable string on an item beyond its name. */
export function listSearchHaystack(task: Task, defs: readonly AttributeDefinition[] = []): string {
  const out: string[] = [itemTitle(task)]
  const t = task as Task & { notes?: string; taskDescription?: string }
  pushText(out, task.description)
  pushText(out, t.taskDescription)
  pushText(out, t.notes)
  for (const entry of task.noteLog ?? []) pushText(out, entry.text)
  for (const res of task.resources ?? []) pushText(out, [res.name, res.caption ?? ""])
  pushText(out, task.body)
  pushText(out, task.why)
  pushText(out, task.consequences)
  pushText(out, task.context)
  pushText(out, task.tags)
  for (const s of task.subtasks ?? []) pushText(out, s.description)
  const names = new Map<string, string>()
  for (const d of [...defs, ...(task.itemAttributeDefinitions ?? [])]) {
    if (d?.id && !names.has(d.id)) names.set(d.id, d.name)
  }
  for (const [id, value] of Object.entries(task.attributes ?? {})) {
    pushText(out, value)
    // A boolean reads as its attribute name too ("owned" finds owned = true).
    if (value === true) pushText(out, names.get(id))
  }
  return out.join("\n").toLowerCase()
}

/**
 * Items in `tasks` matching `query` (case-insensitive; every whitespace-separated
 * word must appear). Name only unless `allFields`.
 */
export function filterListItemsBySearch(
  tasks: Task[],
  query: string,
  opts: { allFields?: boolean; defs?: readonly AttributeDefinition[] } = {},
): Task[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return tasks
  return tasks.filter((task) => {
    const hay = opts.allFields ? listSearchHaystack(task, opts.defs) : itemTitle(task).toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}
