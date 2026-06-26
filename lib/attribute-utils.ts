/**
 * lib/attribute-utils.ts — Attribute type normalization & data migration
 *
 * Maps legacy attribute types (text, url, select, …) to the expanded v2 schema
 * and coerces stored values to match. Run from task-store migrate on load.
 */
import type { AttributeDefinition, AttributeType, AttributeValue, GoalValue, Task, List } from "@/lib/types"

/** Legacy types still present in old persisted data. */
export type LegacyAttributeType =
  | "text"
  | "currency"
  | "url"
  | "select"
  | "multiselect"
  | "date"
  | "location"

const LEGACY_TYPE_MAP: Record<LegacyAttributeType, AttributeType> = {
  text: "string",
  location: "string",
  url: "link",
  date: "datetime",
  currency: "number",
  select: "selection",
  multiselect: "selection",
}

export function isLegacyAttributeType(type: string): type is LegacyAttributeType {
  return type in LEGACY_TYPE_MAP
}

/** Resolve any stored type string to a canonical AttributeType. */
export function normalizeAttributeType(type: string): AttributeType {
  if (isLegacyAttributeType(type)) return LEGACY_TYPE_MAP[type]
  return type as AttributeType
}

export function migrateAttributeDefinition(def: AttributeDefinition): AttributeDefinition {
  const raw = def.type as string
  if (!isLegacyAttributeType(raw)) {
    // Ensure selection/multistring flags are set when missing.
    if (def.type === "selection" && def.allowMultiple === undefined && def.options?.length) {
      return def
    }
    return def
  }

  const type = LEGACY_TYPE_MAP[raw]
  const migrated: AttributeDefinition = { ...def, type }

  switch (raw) {
    case "currency":
      migrated.unit = migrated.unit || "$"
      migrated.allowFloat = migrated.allowFloat ?? true
      break
    case "select":
      migrated.allowMultiple = false
      migrated.optionSource = migrated.optionSource || "manual"
      break
    case "multiselect":
      migrated.allowMultiple = true
      migrated.optionSource = migrated.optionSource || "manual"
      break
    case "date":
      migrated.datetimeMode = migrated.datetimeMode || "date"
      break
    default:
      break
  }

  return migrated
}

function asGoal(v: AttributeValue): GoalValue {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as GoalValue
  return { current: 0, target: 0 }
}

/** Coerce a stored value after its definition was migrated. */
export function migrateAttributeValue(def: AttributeDefinition, value: AttributeValue): AttributeValue {
  if (value === undefined || value === null) return value
  const type = normalizeAttributeType(def.type)

  switch (type) {
    case "multistring":
    case "multiimage":
      if (typeof value === "string") return value ? [value] : []
      if (Array.isArray(value)) return value as string[]
      return []
    case "selection":
      if (def.allowMultiple) {
        if (typeof value === "string") return value ? [value] : []
        if (Array.isArray(value)) return value as string[]
        return []
      }
      if (Array.isArray(value)) return (value as string[])[0] ?? undefined
      return value
    case "number":
      if (typeof value === "string") {
        const n = Number(value.replace(/[$,]/g, ""))
        return Number.isFinite(n) ? n : undefined
      }
      return value
    case "boolean":
      if (typeof value === "string") return value === "true" || value === "yes" || value === "1"
      return !!value
    case "datetime":
      if (value instanceof Date) return value.toISOString()
      return typeof value === "string" ? value : String(value)
    case "goal":
      return asGoal(value)
    default:
      return value
  }
}

export function migrateCategoryAttributes(category: List): List {
  if (!category.itemAttributes?.length) return category
  const itemAttributes = category.itemAttributes.map(migrateAttributeDefinition)
  let defaultAttributeValues = category.defaultAttributeValues
  if (defaultAttributeValues) {
    const next: Record<string, AttributeValue> = { ...defaultAttributeValues }
    itemAttributes.forEach((def) => {
      if (def.id in next) next[def.id] = migrateAttributeValue(def, next[def.id])
    })
    defaultAttributeValues = next
  }
  return { ...category, itemAttributes, defaultAttributeValues }
}

export function migrateTaskAttributes(task: Task, lists: List[]): Task {
  if (!task.attributes || Object.keys(task.attributes).length === 0) return task
  const defs = new Map<string, AttributeDefinition>()
  ;(task.lists ?? []).forEach((cid) => {
    const cat = lists.find((c) => c.id === cid)
    cat?.itemAttributes?.forEach((d) => {
      if (!defs.has(d.id)) defs.set(d.id, migrateAttributeDefinition(d))
    })
  })

  const attributes: Record<string, AttributeValue> = {}
  for (const [id, val] of Object.entries(task.attributes)) {
    const def = defs.get(id)
    attributes[id] = def ? migrateAttributeValue(def, val) : val
  }
  return { ...task, attributes }
}

export function migratePersistedAttributes(state: {
  lists?: List[]
  tasks?: Task[]
}): typeof state {
  const lists = (state.lists ?? []).map(migrateCategoryAttributes)
  const tasks = (state.tasks ?? []).map((t) => migrateTaskAttributes(t, lists))
  return { ...state, lists, tasks }
}

export const ATTRIBUTE_TYPE_LABELS: Record<AttributeType, string> = {
  string: "Text",
  boolean: "Yes/No",
  color: "Color",
  datetime: "Date / time",
  list: "List reference",
  multistring: "Text list",
  number: "Number",
  selection: "Selection",
  image: "Image",
  multiimage: "Image gallery",
  file: "File",
  multifile: "File list",
  item: "Item reference",
  link: "Link",
  goal: "Goal x / y",
  formula: "Formula",
}

/** All types shown when defining a list schema (canonical only). */
export const SCHEMA_ATTRIBUTE_TYPES: AttributeType[] = [
  "string",
  "boolean",
  "color",
  "datetime",
  "list",
  "multistring",
  "number",
  "selection",
  "image",
  "multiimage",
  "item",
  "link",
  "goal",
  "formula",
]
