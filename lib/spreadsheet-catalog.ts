/**
 * lib/spreadsheet-catalog.ts — Attribute → spreadsheet column catalog
 *
 * Pure helpers so Lists spreadsheet (and SheetGrid) can offer **every**
 * attribute held by items on the current list, plus vault-wide attributes and
 * built-in item fields, without React or store imports.
 *
 * Column *choice* is per-list (`SheetViewConfig.columnIds`). Hiding a column
 * removes it from that list's view only — it does not destroy the attribute.
 * Header **Attribute settings** uses `attributeSettingsForColumn` to open the
 * existing schema editor when the column has a real attribute id.
 *
 * Default visible extras (when `columnIds` is unset) stay **lean**: list schema
 * / `displayedAttributes` only — same idea as Details. Held-only attributes and
 * built-ins stay in the picker for opt-in. Wide All Items grids stay calm.
 */
import type {
  AttributeDefinition,
  AttributeType,
  AttributeValue,
  ItemTypeDefinition,
  List,
  Task,
} from "@/lib/types"
import { migrateAttributeDefinition, normalizeAttributeType } from "@/lib/attribute-utils"
import { composeListAttributes } from "@/lib/item-types"
import {
  COMPLETION_STATUSES,
  isCompletionStatus,
  withCompleted,
  withStatus,
} from "@/lib/completion-status"
import { NAME_COLUMN_ID, columnFromDef, type SheetColumn, type SheetViewConfig } from "@/lib/spreadsheet-contract"

/** Prefix for synthetic built-in field column ids (`__field_importance__`). */
export const BUILTIN_COL_PREFIX = "__field_"
export const BUILTIN_COL_SUFFIX = "__"

export type BuiltinFieldKey =
  | "completed"
  | "status"
  | "stage"
  | "importance"
  | "urgency"
  | "cognitiveLoad"
  | "entropy"
  | "estimatedDuration"
  | "actualDuration"
  | "deadline"
  | "scheduledDate"
  | "scheduledTime"
  | "tags"
  | "lists"
  | "type"
  | "context"
  | "why"
  | "createdAt"
  | "completedDate"
  | "rewardValue"
  | "body"

export type CatalogSource = "attribute" | "builtin"

export interface SheetColumnCandidate {
  id: string
  name: string
  type: AttributeType | "name"
  source: CatalogSource
  /** True when this field lives on the current list's schema or its items. */
  onThisList: boolean
  def?: AttributeDefinition
  builtin?: BuiltinFieldKey
  /** Built-in columns that must not be written (Created). */
  readOnly?: boolean
}

export interface BuiltinFieldSpec {
  key: BuiltinFieldKey
  name: string
  type: AttributeType
  /** Noisy always-present fields stay out of the default column set. */
  defaultWhenHeld: boolean
  readOnly?: boolean
  options?: string[]
}

const STAGES = ["inbox", "clarified", "scheduled", "completed", "list"] as const

/** Built-in item/task fields offered as spreadsheet columns. */
export const BUILTIN_FIELD_SPECS: readonly BuiltinFieldSpec[] = [
  { key: "completed", name: "Completed", type: "boolean", defaultWhenHeld: false },
  {
    key: "status",
    name: "Status",
    type: "selection",
    defaultWhenHeld: true,
    options: [...COMPLETION_STATUSES],
  },
  { key: "stage", name: "Stage", type: "selection", defaultWhenHeld: false, options: [...STAGES] },
  { key: "importance", name: "Importance", type: "number", defaultWhenHeld: true },
  { key: "urgency", name: "Urgency", type: "number", defaultWhenHeld: true },
  { key: "cognitiveLoad", name: "Cognitive load", type: "number", defaultWhenHeld: true },
  { key: "entropy", name: "Entropy", type: "number", defaultWhenHeld: true },
  { key: "estimatedDuration", name: "Estimate (min)", type: "number", defaultWhenHeld: true },
  { key: "actualDuration", name: "Actual (min)", type: "number", defaultWhenHeld: true },
  { key: "deadline", name: "Deadline", type: "datetime", defaultWhenHeld: true },
  { key: "scheduledDate", name: "Scheduled date", type: "datetime", defaultWhenHeld: true },
  { key: "scheduledTime", name: "Scheduled time", type: "string", defaultWhenHeld: true },
  { key: "tags", name: "Tags", type: "multistring", defaultWhenHeld: true },
  { key: "lists", name: "Lists", type: "multistring", defaultWhenHeld: true },
  { key: "type", name: "Type", type: "string", defaultWhenHeld: true },
  { key: "context", name: "Context", type: "string", defaultWhenHeld: true },
  { key: "why", name: "Why", type: "string", defaultWhenHeld: true },
  { key: "createdAt", name: "Created", type: "datetime", defaultWhenHeld: false, readOnly: true },
  { key: "completedDate", name: "Completed date", type: "datetime", defaultWhenHeld: true },
  { key: "rewardValue", name: "Reward", type: "number", defaultWhenHeld: true },
  { key: "body", name: "Body", type: "string", defaultWhenHeld: true },
]

export function builtinColumnId(key: BuiltinFieldKey): string {
  return `${BUILTIN_COL_PREFIX}${key}${BUILTIN_COL_SUFFIX}`
}

export function parseBuiltinColumnId(id: string): BuiltinFieldKey | undefined {
  if (!id.startsWith(BUILTIN_COL_PREFIX) || !id.endsWith(BUILTIN_COL_SUFFIX)) return undefined
  const key = id.slice(BUILTIN_COL_PREFIX.length, id.length - BUILTIN_COL_SUFFIX.length)
  return BUILTIN_FIELD_SPECS.some((s) => s.key === key) ? (key as BuiltinFieldKey) : undefined
}

export function isBuiltinColumnId(id: string): boolean {
  return parseBuiltinColumnId(id) !== undefined
}

function specToDef(spec: BuiltinFieldSpec): AttributeDefinition {
  const def: AttributeDefinition = {
    id: builtinColumnId(spec.key),
    name: spec.name,
    type: spec.type,
  }
  if (spec.type === "selection" && spec.options) {
    def.options = spec.options
    def.optionSource = "manual"
  }
  if (spec.type === "datetime") def.datetimeMode = spec.key === "scheduledTime" ? "time" : "date"
  if (spec.type === "number" && (spec.key === "importance" || spec.key === "urgency" || spec.key === "cognitiveLoad")) {
    def.allowFloat = false
  }
  if (spec.key === "estimatedDuration" || spec.key === "actualDuration") def.unit = "min"
  return def
}

/** True when a stored attribute value is "present" (not empty). */
export function hasHeldValue(value: AttributeValue): boolean {
  if (value === undefined || value === null || value === "") return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === "object") {
    const g = value as { current?: unknown; target?: unknown }
    return g.current != null || g.target != null
  }
  return true
}

function inferType(values: AttributeValue[]): AttributeType {
  const present = values.filter(hasHeldValue)
  if (present.length === 0) return "string"
  if (present.every((v) => typeof v === "boolean")) return "boolean"
  if (present.every((v) => typeof v === "number")) return "number"
  if (present.every((v) => Array.isArray(v))) return "multistring"
  if (present.every((v) => v && typeof v === "object" && !Array.isArray(v) && "current" in (v as object))) return "goal"
  if (present.every((v) => typeof v === "string" && looksLikeDate(v))) return "datetime"
  return "string"
}

function looksLikeDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}/.test(s) && !/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s)) return false
  return !Number.isNaN(Date.parse(s))
}

/** Collect attribute definitions known anywhere in the vault. */
export function collectVaultAttributeDefs(
  lists: List[],
  types: ItemTypeDefinition[],
  items: Task[],
): AttributeDefinition[] {
  const byId = new Map<string, AttributeDefinition>()
  const remember = (def: AttributeDefinition) => {
    const migrated = migrateAttributeDefinition(def)
    if (!byId.has(migrated.id)) byId.set(migrated.id, migrated)
  }

  for (const t of types) {
    for (const def of t.attributes ?? []) remember(def)
  }
  for (const list of lists) {
    for (const def of composeListAttributes(list, types)) remember(def)
    for (const def of list.itemAttributes ?? []) remember(def)
  }
  for (const item of items) {
    for (const def of item.itemAttributeDefinitions ?? []) remember(def)
  }

  const valuesById = new Map<string, AttributeValue[]>()
  for (const item of items) {
    for (const [id, value] of Object.entries(item.attributes ?? {})) {
      const list = valuesById.get(id) ?? []
      list.push(value)
      valuesById.set(id, list)
    }
  }
  for (const [id, values] of valuesById) {
    if (byId.has(id)) continue
    remember({ id, name: humanizeId(id), type: inferType(values) })
  }

  return [...byId.values()]
}

function humanizeId(id: string): string {
  const trimmed = id.replace(/^_+|_+$/g, "").replace(/_/g, " ").trim()
  if (!trimmed) return id
  return trimmed.replace(/\b\w/g, (c) => c.toUpperCase())
}

function itemHoldsAttribute(item: Task, id: string): boolean {
  if (item.attributes && Object.prototype.hasOwnProperty.call(item.attributes, id)) return true
  return !!item.itemAttributeDefinitions?.some((d) => d.id === id)
}

function builtinHeldOnItem(item: Task, key: BuiltinFieldKey): boolean {
  switch (key) {
    case "completed":
      return item.completed === true
    case "status":
      return item.status != null && item.status !== "active"
    case "stage":
      return item.stage != null && item.stage !== "list"
    case "importance":
      return item.importance != null
    case "urgency":
      return item.urgency != null
    case "cognitiveLoad":
      return item.cognitiveLoad != null
    case "entropy":
      return item.entropy != null
    case "estimatedDuration":
      return item.estimatedDuration != null
    case "actualDuration":
      return item.actualDuration != null
    case "deadline":
      return item.deadline != null
    case "scheduledDate":
      return item.scheduledDate != null
    case "scheduledTime":
      return !!item.scheduledTime
    case "tags":
      return (item.tags?.length ?? 0) > 0
    case "lists":
      return (item.lists?.length ?? 0) > 1
    case "type":
      return !!item.type
    case "context":
      return !!item.context
    case "why":
      return !!item.why
    case "createdAt":
      return false
    case "completedDate":
      return item.completedDate != null
    case "rewardValue":
      return item.rewardValue != null
    case "body":
      return !!item.body
    default:
      return false
  }
}

export interface BuildCatalogInput {
  list?: List
  lists: List[]
  types: ItemTypeDefinition[]
  /** Items on the current list (rows). */
  listItems: Task[]
  /** Entire vault — used to offer attributes not yet on this list. */
  vaultItems: Task[]
}

/**
 * Full picker catalog: on-this-list attributes first, then vault attributes,
 * with built-in fields mixed in (on-list builtins before unused builtins).
 */
export function buildSpreadsheetCatalog(input: BuildCatalogInput): SheetColumnCandidate[] {
  const { list, lists, types, listItems, vaultItems } = input
  const schemaIds = new Set(list ? composeListAttributes(list, types).map((d) => d.id) : [])
  const vaultDefs = collectVaultAttributeDefs(lists, types, vaultItems)
  const candidates: SheetColumnCandidate[] = []

  for (const def of vaultDefs) {
    const onThisList = schemaIds.has(def.id) || listItems.some((item) => itemHoldsAttribute(item, def.id))
    candidates.push({
      id: def.id,
      name: def.name,
      type: normalizeAttributeType(def.type),
      source: "attribute",
      onThisList,
      def,
    })
  }

  for (const spec of BUILTIN_FIELD_SPECS) {
    const onThisList = listItems.some((item) => builtinHeldOnItem(item, spec.key))
    candidates.push({
      id: builtinColumnId(spec.key),
      name: spec.name,
      type: spec.type,
      source: "builtin",
      onThisList,
      def: specToDef(spec),
      builtin: spec.key,
      readOnly: spec.readOnly,
    })
  }

  return sortCatalog(candidates)
}

/** On-this-list first, attributes before builtins within a group, then name. */
export function sortCatalog(candidates: SheetColumnCandidate[]): SheetColumnCandidate[] {
  const rank = (c: SheetColumnCandidate): number => {
    if (c.onThisList && c.source === "attribute") return 0
    if (c.onThisList && c.source === "builtin") return 1
    if (!c.onThisList && c.source === "attribute") return 2
    return 3
  }
  return [...candidates].sort((a, b) => {
    const d = rank(a) - rank(b)
    if (d !== 0) return d
    return a.name.localeCompare(b.name)
  })
}

export function filterCatalog(
  candidates: SheetColumnCandidate[],
  opts: { query?: string; onThisListOnly?: boolean } = {},
): SheetColumnCandidate[] {
  const q = (opts.query ?? "").trim().toLowerCase()
  return candidates.filter((c) => {
    if (opts.onThisListOnly && !c.onThisList) return false
    if (!q) return true
    return c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || String(c.type).includes(q)
  })
}

/**
 * Default visible extras when `columnIds` is unset: list schema attributes in
 * `displayedAttributes` order (or declaration order). Does **not** pull every
 * held attribute or every held built-in — those stay opt-in via the column
 * picker / Add column. Empty schema (e.g. All Items) → Name-only until the
 * user adds columns.
 */
export function defaultColumnIds(candidates: SheetColumnCandidate[], list?: List, types: ItemTypeDefinition[] = []): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  const known = new Set(candidates.map((c) => c.id))
  const push = (id: string) => {
    if (!id || seen.has(id) || id === NAME_COLUMN_ID) return
    seen.add(id)
    ids.push(id)
  }

  if (list) {
    const schema = composeListAttributes(list, types)
    const schemaIds = new Set(schema.map((d) => d.id))
    const displayed = list.displayedAttributes
    const ordered =
      displayed && displayed.length > 0
        ? displayed.filter((id) => schemaIds.has(id) || known.has(id))
        : schema.map((d) => d.id)
    for (const id of ordered) push(id)
  }

  return ids
}

/** Resolve persisted column ids, falling back to the lean schema default. */
export function resolveColumnIds(
  config: SheetViewConfig | undefined,
  candidates: SheetColumnCandidate[],
  list?: List,
  types: ItemTypeDefinition[] = [],
): string[] {
  const chosen = config?.columnIds
  // `[]` is an explicit "name column only" layout; only `undefined` defaults.
  if (chosen) {
    const known = new Set(candidates.map((c) => c.id))
    return chosen.filter((id) => id !== NAME_COLUMN_ID && (known.has(id) || isBuiltinColumnId(id)))
  }
  return defaultColumnIds(candidates, list, types)
}

export function hideColumnId(columnIds: string[], id: string): string[] {
  return columnIds.filter((x) => x !== id)
}

export function insertColumnId(columnIds: string[], id: string, atIndex?: number): string[] {
  if (columnIds.includes(id)) return columnIds
  if (atIndex == null || atIndex < 0 || atIndex >= columnIds.length) return [...columnIds, id]
  const next = [...columnIds]
  next.splice(atIndex, 0, id)
  return next
}

export function moveColumnId(columnIds: string[], id: string, toIndex: number): string[] {
  const from = columnIds.indexOf(id)
  if (from < 0) return columnIds
  const next = [...columnIds]
  next.splice(from, 1)
  const clamped = Math.max(0, Math.min(toIndex, next.length))
  next.splice(clamped, 0, id)
  return next
}

/**
 * Copy an attribute onto the list schema so every row can hold a value.
 * Empty values are fine — this is membership, not a fill. Does not destroy or
 * replace an existing definition with the same id.
 */
export function assignAttributeToList(list: List, def: AttributeDefinition): List {
  const existing = list.itemAttributes ?? []
  if (existing.some((d) => d.id === def.id)) return list
  const copy: AttributeDefinition = { ...def }
  return { ...list, itemAttributes: [...existing, copy] }
}

/** Replace or add one definition on the list schema. Does not delete other attrs. */
export function patchAttributeOnList(list: List, def: AttributeDefinition): List {
  const existing = list.itemAttributes ?? []
  const idx = existing.findIndex((d) => d.id === def.id)
  if (idx < 0) return assignAttributeToList(list, def)
  const next = [...existing]
  next[idx] = { ...existing[idx], ...def, id: existing[idx].id }
  return { ...list, itemAttributes: next }
}

export const NAME_COLUMN_SETTINGS_REASON =
  "Item name is always the first column — it is not a custom attribute."

export const BUILTIN_COLUMN_SETTINGS_REASON =
  "Built-in item field — not a custom attribute."

export type AttributeSettingsTarget =
  | { kind: "attribute"; id: string; def: AttributeDefinition }
  | { kind: "unavailable"; reason: string }

/**
 * Header-menu "Attribute settings": open the existing schema editor when this
 * column is a real attribute (`def` and not a built-in Task field). Name and
 * `__field_*__` columns stay disabled with a short reason.
 */
export function attributeSettingsForColumn(column: SheetColumn): AttributeSettingsTarget {
  if (column.isName || column.id === NAME_COLUMN_ID) {
    return { kind: "unavailable", reason: NAME_COLUMN_SETTINGS_REASON }
  }
  if (column.builtin) {
    return { kind: "unavailable", reason: BUILTIN_COLUMN_SETTINGS_REASON }
  }
  if (column.def) {
    return { kind: "attribute", id: column.def.id, def: column.def }
  }
  return { kind: "unavailable", reason: "This column has no attribute definition." }
}

export function candidateToColumn(candidate: SheetColumnCandidate): SheetColumn {
  if (candidate.builtin && candidate.def) {
    return {
      ...columnFromDef(candidate.def),
      id: candidate.id,
      builtin: candidate.builtin,
      readOnly: !!candidate.readOnly || candidate.def.type === "formula",
    }
  }
  if (candidate.def) return columnFromDef(candidate.def)
  return {
    id: candidate.id,
    name: candidate.name,
    type: candidate.type === "name" ? "name" : candidate.type,
    isName: false,
    isFormula: false,
    readOnly: !!candidate.readOnly,
  }
}

export function columnsFromIds(
  candidates: SheetColumnCandidate[],
  columnIds: string[],
): SheetColumn[] {
  const byId = new Map(candidates.map((c) => [c.id, c]))
  return columnIds
    .map((id) => byId.get(id))
    .filter((c): c is SheetColumnCandidate => !!c)
    .map(candidateToColumn)
}

function asStringArray(value: AttributeValue): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter((s) => s.trim() !== "")
  if (typeof value === "string") {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (value == null || value === "") return []
  return [String(value)]
}

function asDate(value: AttributeValue): Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? undefined : d
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = parseLooseDate(value.trim())
    return parsed
  }
  return undefined
}

/** Accept ISO, YYYY-MM-DD, and common US/EU numeric dates. */
export function parseLooseDate(raw: string): Date | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const iso = Date.parse(trimmed)
  if (!Number.isNaN(iso)) return new Date(iso)
  const m = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    let y = Number(m[3])
    if (y < 100) y += 2000
    const monthFirst = a <= 12
    const month = monthFirst ? a : b
    const day = monthFirst ? b : a
    const d = new Date(y, month - 1, day)
    if (!Number.isNaN(d.getTime())) return d
  }
  return undefined
}

export function readBuiltinField(task: Task, key: BuiltinFieldKey, listNameById?: Map<string, string>): AttributeValue {
  switch (key) {
    case "completed":
      return !!task.completed
    case "status":
      return task.status ?? (task.completed ? "done" : "active")
    case "stage":
      return task.stage
    case "importance":
      return task.importance
    case "urgency":
      return task.urgency
    case "cognitiveLoad":
      return task.cognitiveLoad
    case "entropy":
      return task.entropy
    case "estimatedDuration":
      return task.estimatedDuration
    case "actualDuration":
      return task.actualDuration
    case "deadline":
      return formatDateValue(task.deadline)
    case "scheduledDate":
      return formatDateValue(task.scheduledDate)
    case "scheduledTime":
      return task.scheduledTime
    case "tags":
      return task.tags ?? []
    case "lists":
      return (task.lists ?? []).map((id) => listNameById?.get(id) ?? id)
    case "type":
      return task.type
    case "context":
      return task.context
    case "why":
      return task.why
    case "createdAt":
      return formatDateValue(task.createdAt)
    case "completedDate":
      return formatDateValue(task.completedDate)
    case "rewardValue":
      return task.rewardValue
    case "body":
      return task.body
    default:
      return undefined
  }
}

function formatDateValue(value: Date | string | undefined): string | undefined {
  if (!value) return undefined
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : undefined
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export function writeBuiltinField(
  task: Task,
  key: BuiltinFieldKey,
  value: AttributeValue,
  ctx?: { lists?: List[] },
): Task {
  switch (key) {
    case "completed":
      return withCompleted(task, coerceBoolean(value))
    case "status": {
      const raw = String(value ?? "").trim().toLowerCase()
      if (isCompletionStatus(raw)) return withStatus(task, raw)
      const labels: Record<string, typeof raw> = {
        done: "done",
        complete: "done",
        completed: "done",
        missed: "missed",
        cancelled: "cancelled",
        canceled: "cancelled",
        deferred: "deferred",
        partial: "partial",
        active: "active",
      }
      const mapped = labels[raw]
      return isCompletionStatus(mapped) ? withStatus(task, mapped) : task
    }
    case "stage": {
      const s = String(value ?? "").trim()
      if ((STAGES as readonly string[]).includes(s)) return { ...task, stage: s as Task["stage"] }
      return task
    }
    case "importance":
      return { ...task, importance: clampInt(value, 1, 5) }
    case "urgency":
      return { ...task, urgency: clampInt(value, 1, 5) }
    case "cognitiveLoad":
      return { ...task, cognitiveLoad: clampInt(value, 1, 3) }
    case "entropy": {
      const n = Number(value)
      return { ...task, entropy: Number.isFinite(n) ? n : undefined }
    }
    case "estimatedDuration":
      return { ...task, estimatedDuration: clampInt(value, 0, 24 * 60 * 7) }
    case "actualDuration":
      return { ...task, actualDuration: clampInt(value, 0, 24 * 60 * 7) }
    case "deadline":
      return { ...task, deadline: asDate(value) }
    case "scheduledDate":
      return { ...task, scheduledDate: asDate(value) }
    case "scheduledTime":
      return { ...task, scheduledTime: value == null || value === "" ? undefined : String(value) }
    case "tags":
      return { ...task, tags: asStringArray(value) }
    case "lists": {
      const names = asStringArray(value)
      if (!ctx?.lists) return task
      const byName = new Map(ctx.lists.map((l) => [l.name.toLowerCase(), l.id]))
      const byId = new Set(ctx.lists.map((l) => l.id))
      const ids = names
        .map((n) => (byId.has(n) ? n : byName.get(n.toLowerCase())))
        .filter((id): id is string => !!id)
      return { ...task, lists: ids.length ? ids : task.lists }
    }
    case "type":
      return { ...task, type: value == null || value === "" ? undefined : String(value) }
    case "context":
      return { ...task, context: value == null || value === "" ? undefined : String(value) }
    case "why":
      return { ...task, why: value == null || value === "" ? undefined : String(value) }
    case "createdAt":
      return task
    case "completedDate":
      return { ...task, completedDate: asDate(value) }
    case "rewardValue": {
      const n = Number(value)
      return { ...task, rewardValue: Number.isFinite(n) ? n : undefined }
    }
    case "body":
      return { ...task, body: value == null || value === "" ? undefined : String(value) }
    default:
      return task
  }
}

function coerceBoolean(value: AttributeValue): boolean {
  if (typeof value === "boolean") return value
  const s = String(value ?? "").trim().toLowerCase()
  return s === "true" || s === "yes" || s === "1"
}

function clampInt(value: AttributeValue, min: number, max: number): number | undefined {
  if (value === undefined || value === null || value === "") return undefined
  const n = typeof value === "number" ? value : parseInt(String(value), 10)
  if (!Number.isFinite(n)) return undefined
  return Math.max(min, Math.min(max, Math.round(n)))
}

/** Printable character that should start type-to-replace in a selected cell. */
export function isTypeToReplaceKey(e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false
  if (e.key.length !== 1) return false
  return !/[\u0000-\u001F]/.test(e.key)
}
