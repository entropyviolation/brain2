/**
 * lib/item-types.ts — Item-type registry helpers (spec §5)
 *
 * An *item type* is a named category of items with associated attributes, rules,
 * and behaviors (see `ItemTypeDefinition`). "task" ships built-in; users define
 * their own ("Book", "Friend", …) through `useItemTypeStore`. These helpers are
 * pure and serializable so the same logic works in the browser, on a server, or
 * in another app.
 *
 * Composition model: an item's *effective* attribute schema is its type's
 * attributes unioned with the attributes of every category (list) it belongs to.
 * Defaults compose the same way (type defaults first, then category defaults).
 */

import type {
  AttributeDefinition,
  AttributeValue,
  ItemDetailLayout,
  ItemDetailPanel,
  ItemRuleCondition,
  ItemType,
  ItemTypeCapabilities,
  ItemTypeDefinition,
  ItemTypeRule,
} from "@/lib/types"
import { withOperationType } from "@/lib/operation-types"
import { withNoteType } from "@/lib/note-types"
import { withBookType } from "@/lib/book-types"
import { withFlightType } from "@/lib/flight-types"
import { withCatalogTypes } from "@/lib/catalog-types"

export const BUILTIN_TASK_TYPE_ID = "task"
export const BUILTIN_ITEM_TYPE_ID = "item"
export const LOGGED_ACTION_TYPE_ID = "action"

/** System type ids: always re-seeded from code; capabilities/panels locked. */
export const SYSTEM_TYPE_IDS = [
  BUILTIN_TASK_TYPE_ID,
  BUILTIN_ITEM_TYPE_ID,
  "note",
  "operation",
] as const

export const DETAIL_PANEL_ORDER: ItemDetailPanel[] = [
  "details",
  "scheduling",
  "dependencies",
  "subtasks",
  "analysis",
  "time",
  "body",
]

/** Loose shape for rule/attribute evaluation — works for Task and any Item. */
export type ItemLike = {
  attributes?: Record<string, AttributeValue>
} & Record<string, unknown>

/** Minimal category shape needed to compose attributes/defaults. */
export interface AttributeSource {
  itemAttributes?: AttributeDefinition[]
  defaultAttributeValues?: Record<string, AttributeValue>
}

/** The built-in types shipped with the app. */
export function getBuiltinItemTypes(): ItemTypeDefinition[] {
  // Item + Task ship first; Operation, Note, Book, Flight, and catalog starters
  // merge in via idempotent helpers so each module owns its definition.
  return withCatalogTypes(
    withFlightType(withBookType(withNoteType(withOperationType(getBaseBuiltinItemTypes())))),
  )
}

/** The always-present core system types. */
function getBaseBuiltinItemTypes(): ItemTypeDefinition[] {
  return [
    {
      id: BUILTIN_ITEM_TYPE_ID,
      name: "Item",
      pluralName: "Items",
      itemLabel: "item",
      builtin: true,
      kind: "system",
      description: "A generic record. Details only — not a task unless you opt into capabilities.",
      attributes: [],
      detailPanels: ["details"],
      capabilities: {},
    },
    {
      id: BUILTIN_TASK_TYPE_ID,
      name: "Task",
      pluralName: "Tasks",
      itemLabel: "task",
      builtin: true,
      kind: "system",
      description: "An actionable item with optional scheduling, points, and subtasks.",
      capabilities: {
        scheduleable: true,
        nextActions: true,
        points: true,
        duration: true,
        deadline: true,
        subtasks: true,
        completable: true,
      },
      detailPanels: ["details", "scheduling", "dependencies", "subtasks", "analysis", "time"],
      attributes: [],
      rules: [
        {
          id: "task-require-title",
          name: "Title is required",
          trigger: "validate",
          action: { kind: "require", field: "title", message: "A task needs a title." },
        },
      ],
    },
  ]
}

export function isSystemItemType(type: Pick<ItemTypeDefinition, "id" | "kind">): boolean {
  if (type.kind === "system") return true
  return (SYSTEM_TYPE_IDS as readonly string[]).includes(type.id as string)
}

export function isCatalogItemType(type: Pick<ItemTypeDefinition, "kind">): boolean {
  return type.kind === "catalog"
}

/**
 * Merge persisted types with seeds: system ids always come from code; catalog
 * ids keep the stored definition if present and only insert the seed when missing.
 */
export function mergeTypeRegistry(stored: ItemTypeDefinition[]): ItemTypeDefinition[] {
  const seeds = getBuiltinItemTypes()
  const storedById = new Map(stored.map((t) => [t.id as string, t]))
  const result: ItemTypeDefinition[] = []
  const seen = new Set<string>()

  for (const seed of seeds) {
    const id = seed.id as string
    seen.add(id)
    if (isSystemItemType(seed)) {
      result.push(seed)
      continue
    }
    result.push(storedById.get(id) ?? seed)
  }
  for (const t of stored) {
    const id = t.id as string
    if (!seen.has(id)) {
      result.push(t)
      seen.add(id)
    }
  }
  return result
}

/** Resolve a type definition by id, falling back to the generic item type. */
export function getItemType(
  types: ItemTypeDefinition[],
  id: string | undefined,
): ItemTypeDefinition {
  return (
    types.find((t) => t.id === id) ??
    types.find((t) => t.id === BUILTIN_ITEM_TYPE_ID) ??
    types.find((t) => t.id === BUILTIN_TASK_TYPE_ID) ??
    getBuiltinItemTypes()[0]
  )
}

/** Parent chain for a type id, root-first (e.g. [Book, Fiction Book]). */
export function typeAncestorChain(
  typeId: ItemType | undefined,
  types: ItemTypeDefinition[],
): ItemTypeDefinition[] {
  const chain: ItemTypeDefinition[] = []
  const seen = new Set<string>()
  let current = typeId ? exactType(types, typeId) : undefined
  while (current && !seen.has(current.id as string)) {
    chain.unshift(current)
    seen.add(current.id as string)
    current = current.parentTypeId ? exactType(types, current.parentTypeId) : undefined
  }
  return chain
}

/** Effective attribute schema for a type, including inherited parent attributes. */
export function collectTypeAttributes(
  typeId: ItemType | undefined,
  types: ItemTypeDefinition[],
): AttributeDefinition[] {
  const byId = new Map<string, AttributeDefinition>()
  for (const t of typeAncestorChain(typeId, types)) {
    for (const attr of t.attributes ?? []) byId.set(attr.id, attr)
  }
  return [...byId.values()]
}

/** Effective default values for a type, with child overrides on parent defaults. */
export function collectTypeDefaults(
  typeId: ItemType | undefined,
  types: ItemTypeDefinition[],
): Record<string, AttributeValue> {
  const defaults: Record<string, AttributeValue> = {}
  for (const t of typeAncestorChain(typeId, types)) {
    Object.assign(defaults, t.defaultAttributeValues ?? {})
  }
  return defaults
}

/** Effective capabilities for a type, child flags overriding parent. */
export function collectTypeCapabilities(
  typeId: ItemType | undefined,
  types: ItemTypeDefinition[],
): ItemTypeCapabilities {
  const caps: ItemTypeCapabilities = {}
  for (const t of typeAncestorChain(typeId, types)) {
    Object.assign(caps, t.capabilities ?? {})
  }
  return caps
}

/** Effective detail layout: child overrides parent fields. */
export function collectTypeLayout(
  typeId: ItemType | undefined,
  types: ItemTypeDefinition[],
): ItemDetailLayout | undefined {
  let layout: ItemDetailLayout | undefined
  for (const t of typeAncestorChain(typeId, types)) {
    if (t.detailLayout) layout = { ...layout, ...t.detailLayout }
  }
  return layout
}

function inferPanelsFromCapabilities(caps: ItemTypeCapabilities, isTask: boolean): ItemDetailPanel[] {
  if (isTask) {
    return ["details", "scheduling", "dependencies", "subtasks", "analysis", "time"]
  }
  const panels: ItemDetailPanel[] = ["details"]
  if (caps.scheduleable || caps.deadline) panels.push("scheduling")
  if (caps.subtasks) panels.push("subtasks")
  if (caps.duration) panels.push("time")
  return panels
}

export interface DetailListSource {
  id: string
  itemTypeId?: ItemType
  detailPanels?: ItemDetailPanel[]
  hiddenDetailPanels?: ItemDetailPanel[]
}

export interface DetailViewResolution {
  panels: ItemDetailPanel[]
  capabilities: ItemTypeCapabilities
  layout?: ItemDetailLayout
}

/**
 * Resolve which detail tabs, capabilities, and layout an item should show.
 * Type panels (or capability inference) first, lists may add panels, then
 * hiddenDetailPanels and capabilities filter the result. Next-action / Task
 * items inherit Task capabilities so the hardcoded Task surface still works.
 */
export function resolveDetailView(
  item: { type?: ItemType; lists?: string[] },
  lists: DetailListSource[],
  types: ItemTypeDefinition[],
  opts?: { isTask?: boolean },
): DetailViewResolution {
  const isTask = opts?.isTask ?? false
  const ownType = exactType(types, item.type)
  const fallbackId = isTask ? BUILTIN_TASK_TYPE_ID : BUILTIN_ITEM_TYPE_ID
  const typeDef = ownType ?? exactType(types, fallbackId)

  let capabilities = collectTypeCapabilities(typeDef?.id ?? item.type, types)
  if (isTask) {
    capabilities = { ...collectTypeCapabilities(BUILTIN_TASK_TYPE_ID, types), ...capabilities }
  }

  const typePanels =
    typeDef?.detailPanels && typeDef.detailPanels.length > 0
      ? [...typeDef.detailPanels]
      : inferPanelsFromCapabilities(capabilities, isTask)

  const memberLists = (item.lists ?? [])
    .map((id) => lists.find((l) => l.id === id))
    .filter((l): l is DetailListSource => !!l)
  const listAdded = memberLists.flatMap((l) => l.detailPanels ?? [])
  const hidden = new Set(memberLists.flatMap((l) => l.hiddenDetailPanels ?? []))

  const merged = new Set<ItemDetailPanel>([...typePanels, ...listAdded])
  if (item.type === "note") merged.add("body")

  const typeListed = new Set(typeDef?.detailPanels ?? [])
  const listListed = new Set(listAdded)

  const panels = DETAIL_PANEL_ORDER.filter((panel) => {
    if (!merged.has(panel)) return false
    if (hidden.has(panel)) return false
    if (panel === "details" || panel === "body") return true
    if (panel === "scheduling" && !capabilities.scheduleable && !capabilities.deadline && !isTask) {
      return false
    }
    if (panel === "subtasks" && !capabilities.subtasks && !isTask) return false
    if (panel === "time" && !capabilities.duration && !isTask) return false
    if (panel === "analysis" && !isTask && !typeListed.has("analysis") && !listListed.has("analysis")) {
      return false
    }
    if (
      panel === "dependencies" &&
      !isTask &&
      !typeListed.has("dependencies") &&
      !listListed.has("dependencies")
    ) {
      return false
    }
    return true
  })

  if (!panels.includes("details")) panels.unshift("details")

  return {
    panels: panels.length ? panels : ["details"],
    capabilities,
    layout: collectTypeLayout(typeDef?.id ?? item.type, types),
  }
}

/** All direct and nested subtypes of `parentId`. */
export function descendantTypeIds(parentId: string, types: ItemTypeDefinition[]): Set<string> {
  const ids = new Set<string>([parentId])
  let changed = true
  while (changed) {
    changed = false
    for (const t of types) {
      const pid = t.parentTypeId as string | undefined
      if (pid && ids.has(pid) && !ids.has(t.id as string)) {
        ids.add(t.id as string)
        changed = true
      }
    }
  }
  return ids
}

/** Direct child types of `parentId`. */
export function subtypesOf(parentId: string, types: ItemTypeDefinition[]): ItemTypeDefinition[] {
  return types.filter((t) => t.parentTypeId === parentId)
}

/**
 * Effective attribute schema for an item: the type's attributes unioned with the
 * attributes of every category it belongs to. Type attributes win on id clash.
 */
export function resolveAttributes(
  type: ItemTypeDefinition | undefined,
  lists: AttributeSource[] = [],
): AttributeDefinition[] {
  const byId = new Map<string, AttributeDefinition>()
  for (const cat of lists) {
    for (const attr of cat.itemAttributes ?? []) byId.set(attr.id, attr)
  }
  // Type attributes applied last so they take precedence over category ones.
  for (const attr of type?.attributes ?? []) byId.set(attr.id, attr)
  return [...byId.values()]
}

/**
 * Effective default attribute values: category defaults first, then the type's
 * defaults override (the type is the more specific definition of the item).
 */
export function resolveDefaultValues(
  type: ItemTypeDefinition | undefined,
  lists: AttributeSource[] = [],
): Record<string, AttributeValue> {
  const defaults: Record<string, AttributeValue> = {}
  for (const cat of lists) Object.assign(defaults, cat.defaultAttributeValues ?? {})
  Object.assign(defaults, type?.defaultAttributeValues ?? {})
  return defaults
}

/** The minimal category shape the per-list composition helpers need. */
export interface TypedAttributeSource extends AttributeSource {
  itemTypeId?: ItemType
  rules?: ItemTypeRule[]
}

/** Resolve a type by id only when it actually exists (no task-type fallback). */
function exactType(
  types: ItemTypeDefinition[],
  id: ItemType | undefined,
): ItemTypeDefinition | undefined {
  if (!id) return undefined
  return types.find((t) => t.id === id)
}

/**
 * A single list's *effective* attribute schema: its item type's attributes plus
 * the list-specific attributes layered on top. List attributes win on id clash
 * (they are the more specific, list-scoped definition).
 */
export function composeListAttributes(
  category: TypedAttributeSource,
  types: ItemTypeDefinition[],
): AttributeDefinition[] {
  const byId = new Map<string, AttributeDefinition>()
  for (const attr of collectTypeAttributes(category.itemTypeId, types)) byId.set(attr.id, attr)
  for (const attr of category.itemAttributes ?? []) byId.set(attr.id, attr)
  return [...byId.values()]
}

/**
 * A single list's effective default values: the item type's defaults first, then
 * the list's own defaults override (the list is the more specific definition).
 */
export function composeListDefaults(
  category: TypedAttributeSource,
  types: ItemTypeDefinition[],
): Record<string, AttributeValue> {
  return {
    ...collectTypeDefaults(category.itemTypeId, types),
    ...(category.defaultAttributeValues ?? {}),
  }
}

/**
 * The complete attribute schema for an *item*: the union of every list it
 * belongs to (each list contributing its own effective schema, see
 * `composeListAttributes`) plus the item's own type attributes (so a typed
 * item keeps its fields even when it currently belongs to no typed list).
 */
export function resolveItemSchema(
  item: { type?: ItemType; lists?: string[] },
  lists: (TypedAttributeSource & { id: string })[],
  types: ItemTypeDefinition[],
): AttributeDefinition[] {
  const byId = new Map<string, AttributeDefinition>()
  for (const cid of item.lists ?? []) {
    const cat = lists.find((c) => c.id === cid)
    if (!cat) continue
    for (const def of composeListAttributes(cat, types)) {
      if (!byId.has(def.id)) byId.set(def.id, def)
    }
  }
  const ownType = exactType(types, item.type)
  for (const def of collectTypeAttributes(ownType?.id ?? item.type, types)) {
    if (!byId.has(def.id)) byId.set(def.id, def)
  }
  return [...byId.values()]
}

/**
 * Every item *type* "assigned" to an item, for display in the item-detail view.
 *
 * An item carries a single primary `type`, but by belonging to lists that each
 * pin an `itemTypeId` it effectively participates in several types (e.g. a Task
 * that also lives in a "Goals" list reads as both Task and Goal). This returns
 * the resolved `ItemTypeDefinition`s — the item's own type first, then each
 * distinct list-pinned type — deduplicated by id. The own type falls back to the
 * generic item type; unknown/unregistered ids are skipped.
 */
export function assignedItemTypes(
  item: { type?: ItemType; lists?: string[] },
  lists: { id: string; itemTypeId?: ItemType }[],
  types: ItemTypeDefinition[],
): ItemTypeDefinition[] {
  const orderedIds: ItemType[] = [item.type ?? BUILTIN_ITEM_TYPE_ID]
  for (const cid of item.lists ?? []) {
    const pinned = lists.find((c) => c.id === cid)?.itemTypeId
    if (pinned) orderedIds.push(pinned)
  }
  const seen = new Set<string>()
  const result: ItemTypeDefinition[] = []
  for (const id of orderedIds) {
    if (seen.has(id as string)) continue
    for (const def of typeAncestorChain(id, types)) {
      if (seen.has(def.id as string)) continue
      seen.add(def.id as string)
      result.push(def)
    }
  }
  return result
}

/** All items whose primary type or list membership matches `typeId` (includes subtypes). */
export function itemsOfType<
  T extends { id: string; type?: ItemType; lists?: string[]; description?: string; title?: string },
>(
  typeId: string,
  items: T[],
  lists: { id: string; itemTypeId?: ItemType }[],
  types: ItemTypeDefinition[] = [],
): T[] {
  const matchingTypeIds = descendantTypeIds(typeId, types)
  const listIdsWithType = new Set(
    lists.filter((l) => l.itemTypeId && matchingTypeIds.has(l.itemTypeId as string)).map((l) => l.id),
  )
  return items.filter(
    (item) =>
      (item.type && matchingTypeIds.has(item.type as string)) ||
      (item.lists ?? []).some((cid) => listIdsWithType.has(cid)),
  )
}

/** Gather the rules that apply to an item: its type's rules plus every list's. */
export function gatherItemRules(
  type: ItemTypeDefinition | undefined,
  lists: TypedAttributeSource[],
  allTypes?: ItemTypeDefinition[],
): ItemTypeRule[] {
  const byId = new Map<string, ItemTypeRule>()
  if (type) {
    const chain = allTypes ? typeAncestorChain(type.id, allTypes) : [type]
    for (const t of chain) {
      for (const rule of t.rules ?? []) byId.set(rule.id, rule)
    }
  }
  for (const cat of lists) {
    for (const rule of cat.rules ?? []) byId.set(rule.id, rule)
  }
  return [...byId.values()]
}

/** Read a field from an item: attribute first, then a top-level field. */
export function getFieldValue(item: ItemLike, field: string): unknown {
  if (item.attributes && field in item.attributes) return item.attributes[field]
  return item[field]
}

function isEmpty(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === "string") return value.trim() === ""
  if (Array.isArray(value)) return value.length === 0
  return false
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

function numericDelta(previous: ItemLike | undefined, current: ItemLike, field: string): number {
  const prev = previous ? asNumber(getFieldValue(previous, field)) : undefined
  const curr = asNumber(getFieldValue(current, field))
  if (curr === undefined) return 0
  return curr - (prev ?? 0)
}

/** Evaluate a serializable rule condition against an item. */
export function evaluateCondition(
  item: ItemLike,
  condition: ItemRuleCondition,
  previous?: ItemLike,
): boolean {
  const actual = getFieldValue(item, condition.field)
  const expected = condition.value
  switch (condition.operator) {
    case "exists":
      return !isEmpty(actual)
    case "empty":
      return isEmpty(actual)
    case "eq":
      return actual === expected
    case "neq":
      return actual !== expected
    case "gt":
      return typeof actual === "number" && typeof expected === "number" && actual > expected
    case "gte":
      return typeof actual === "number" && typeof expected === "number" && actual >= expected
    case "lt":
      return typeof actual === "number" && typeof expected === "number" && actual < expected
    case "lte":
      return typeof actual === "number" && typeof expected === "number" && actual <= expected
    case "contains":
      if (Array.isArray(actual)) return actual.includes(expected as never)
      if (typeof actual === "string") return actual.includes(String(expected))
      return false
    case "changed": {
      if (!previous) return false
      return getFieldValue(previous, condition.field) !== actual
    }
    case "increased": {
      if (!previous) return false
      const prev = asNumber(getFieldValue(previous, condition.field))
      const curr = asNumber(actual)
      if (curr === undefined) return false
      return curr > (prev ?? 0)
    }
    case "decreased": {
      if (!previous) return false
      const prev = asNumber(getFieldValue(previous, condition.field))
      const curr = asNumber(actual)
      if (curr === undefined || prev === undefined) return false
      return curr < prev
    }
    default:
      return false
  }
}

export type ImpliedRuleEffect =
  | {
      kind: "logAction"
      titleTemplate: string
      awardPoints?: boolean
      field?: string
      delta: number
    }
  | { kind: "incrementHabit"; habitId: string; amount: number }

export interface RuleApplication<T extends ItemLike> {
  /** Item with automation actions (setDefault/setAttribute/addTag) applied. */
  item: T
  /** Validation messages from `require`/`block` actions that failed. */
  errors: string[]
  /** True if any matched rule requested adding the item to Next Actions. */
  addToNextActions: boolean
  /** Side effects that must run after the item is persisted (log Done, habits). */
  effects: ImpliedRuleEffect[]
}

/**
 * Apply an explicit list of rules matching `trigger`. Automation actions
 * (setDefault/setAttribute/addTag) mutate a copy of the item; `require`/`block`
 * actions surface as validation errors. Disabled rules are skipped.
 * Pass `previous` on update so `increased` / `decreased` / `changed` work.
 */
export function applyRules<T extends ItemLike>(
  item: T,
  rules: ItemTypeRule[] | undefined,
  trigger: ItemTypeRule["trigger"],
  previous?: ItemLike,
): RuleApplication<T> {
  const next: ItemLike = { ...item, attributes: { ...(item.attributes ?? {}) } }
  const errors: string[] = []
  let addToNextActions = false
  const effects: ImpliedRuleEffect[] = []

  for (const rule of rules ?? []) {
    if (rule.enabled === false) continue
    if (rule.trigger !== trigger) continue
    if (rule.when && !evaluateCondition(next, rule.when, previous)) continue

    const action = rule.action
    switch (action.kind) {
      case "require":
        if (isEmpty(getFieldValue(next, action.field))) {
          errors.push(action.message ?? `${action.field} is required.`)
        }
        break
      case "block":
        errors.push(action.message)
        break
      case "setDefault":
        if (isEmpty(getFieldValue(next, action.field))) {
          setField(next, action.field, action.value)
        }
        break
      case "setAttribute":
        setField(next, action.field, action.value)
        break
      case "addTag": {
        const tags = Array.isArray(next.tags) ? [...(next.tags as string[])] : []
        if (!tags.includes(action.tag)) tags.push(action.tag)
        next.tags = tags
        break
      }
      case "addToNextActions":
        addToNextActions = true
        break
      case "logAction": {
        const field = rule.when?.field
        const delta = field ? numericDelta(previous, next, field) : 0
        effects.push({
          kind: "logAction",
          titleTemplate: action.titleTemplate,
          awardPoints: action.awardPoints,
          field,
          delta,
        })
        break
      }
      case "incrementHabit": {
        const field = rule.when?.field
        const amount =
          action.amount === "delta" ? (field ? numericDelta(previous, next, field) : 0) : action.amount
        if (amount !== 0) {
          effects.push({ kind: "incrementHabit", habitId: action.habitId, amount })
        }
        break
      }
    }
  }

  return { item: next as T, errors, addToNextActions, effects }
}

/**
 * Apply a type's rules matching `trigger`. Thin wrapper over `applyRules` for
 * callers that already hold an `ItemTypeDefinition`.
 */
export function applyRulesFor<T extends ItemLike>(
  item: T,
  type: ItemTypeDefinition | undefined,
  trigger: ItemTypeRule["trigger"],
  previous?: ItemLike,
): RuleApplication<T> {
  return applyRules(item, type?.rules, trigger, previous)
}

function setField(item: ItemLike, field: string, value: AttributeValue) {
  if (item.attributes && field in item.attributes) {
    item.attributes[field] = value
  } else if (field in item) {
    item[field] = value
  } else {
    // Default unknown fields onto attributes so schema-driven values stay grouped.
    item.attributes = { ...(item.attributes ?? {}), [field]: value }
  }
}

/** Convenience: collect validation errors for an item (the "validate" trigger). */
export function validateItem(
  item: ItemLike,
  type: ItemTypeDefinition | undefined,
): string[] {
  return applyRulesFor(item, type, "validate").errors
}
