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
  ItemRuleCondition,
  ItemType,
  ItemTypeDefinition,
  ItemTypeRule,
} from "@/lib/types"
import { withOperationType } from "@/lib/operation-types"
import { withNoteType } from "@/lib/note-types"
import { withBookType } from "@/lib/book-types"
import { withFlightType } from "@/lib/flight-types"

export const BUILTIN_TASK_TYPE_ID = "task"

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
  // Task ships first; the Operation (Worker B), Note, Book, and Flight built-in
  // types are merged in via their own idempotent helpers so each module owns
  // its definition. Merges are no-ops once the type is present.
  return withFlightType(withBookType(withNoteType(withOperationType(getBaseBuiltinItemTypes()))))
}

/** The always-present core built-in type(s). */
function getBaseBuiltinItemTypes(): ItemTypeDefinition[] {
  return [
    {
      id: BUILTIN_TASK_TYPE_ID,
      name: "Task",
      pluralName: "Tasks",
      itemLabel: "task",
      builtin: true,
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
      // Task's core fields are first-class on the `Task` interface, so the type
      // adds no extra attributes by default. User types layer their own here.
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

/** Resolve a type definition by id, falling back to the built-in task type. */
export function getItemType(
  types: ItemTypeDefinition[],
  id: string | undefined,
): ItemTypeDefinition {
  return (
    types.find((t) => t.id === id) ??
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
 * built-in task type; unknown/unregistered ids are skipped.
 */
export function assignedItemTypes(
  item: { type?: ItemType; lists?: string[] },
  lists: { id: string; itemTypeId?: ItemType }[],
  types: ItemTypeDefinition[],
): ItemTypeDefinition[] {
  const orderedIds: ItemType[] = [item.type ?? BUILTIN_TASK_TYPE_ID]
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
export function itemsOfType(
  typeId: string,
  items: { id: string; type?: ItemType; lists?: string[]; description?: string; title?: string }[],
  lists: { id: string; itemTypeId?: ItemType }[],
  types: ItemTypeDefinition[] = [],
): typeof items {
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

/** Evaluate a serializable rule condition against an item. */
export function evaluateCondition(item: ItemLike, condition: ItemRuleCondition): boolean {
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
    default:
      return false
  }
}

export interface RuleApplication<T extends ItemLike> {
  /** Item with automation actions (setDefault/setAttribute/addTag) applied. */
  item: T
  /** Validation messages from `require`/`block` actions that failed. */
  errors: string[]
  /** True if any matched rule requested adding the item to Next Actions. */
  addToNextActions: boolean
}

/**
 * Apply an explicit list of rules matching `trigger`. Automation actions
 * (setDefault/setAttribute/addTag) mutate a copy of the item; `require`/`block`
 * actions surface as validation errors. Disabled rules are skipped.
 */
export function applyRules<T extends ItemLike>(
  item: T,
  rules: ItemTypeRule[] | undefined,
  trigger: ItemTypeRule["trigger"],
): RuleApplication<T> {
  const next: ItemLike = { ...item, attributes: { ...(item.attributes ?? {}) } }
  const errors: string[] = []
  let addToNextActions = false

  for (const rule of rules ?? []) {
    if (rule.enabled === false) continue
    if (rule.trigger !== trigger) continue
    if (rule.when && !evaluateCondition(next, rule.when)) continue

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
    }
  }

  return { item: next as T, errors, addToNextActions }
}

/**
 * Apply a type's rules matching `trigger`. Thin wrapper over `applyRules` for
 * callers that already hold an `ItemTypeDefinition`.
 */
export function applyRulesFor<T extends ItemLike>(
  item: T,
  type: ItemTypeDefinition | undefined,
  trigger: ItemTypeRule["trigger"],
): RuleApplication<T> {
  return applyRules(item, type?.rules, trigger)
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
