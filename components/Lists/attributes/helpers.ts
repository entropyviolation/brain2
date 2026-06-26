/**
 * components/Lists/attributes/helpers.ts — Attribute value/schema helpers
 *
 * Pure (plus store reads) helpers shared by the attribute editors: value
 * coercion (`asGoal`/`asArray`), definition normalization (`effectiveDef`),
 * id slugging, list-attribute merging, and display formatting.
 */
import type { AttributeDefinition, AttributeValue, FileValue, GoalValue, ItemTypeDefinition, Task, List } from "@/lib/types"
import { migrateAttributeDefinition, normalizeAttributeType } from "@/lib/attribute-utils"
import { composeListAttributes, resolveItemSchema } from "@/lib/item-types"
import { useTaskStore } from "@/lib/task-store"

export function asGoal(v: AttributeValue): GoalValue {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as GoalValue
  return { current: 0, target: 0 }
}

export function asArray(v: AttributeValue): string[] {
  return Array.isArray(v) ? (v as string[]) : []
}

/** Structural guard for an attached-file value. */
export function isFileValue(v: unknown): v is FileValue {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    typeof (v as FileValue).uri === "string" &&
    typeof (v as FileValue).mime === "string"
  )
}

/** Coerce a stored value to a single `FileValue` (or undefined). */
export function asFile(v: AttributeValue): FileValue | undefined {
  if (isFileValue(v)) return v
  if (Array.isArray(v) && isFileValue(v[0])) return v[0] as FileValue
  return undefined
}

/** Coerce a stored value to an array of `FileValue`s. */
export function asFiles(v: AttributeValue): FileValue[] {
  if (Array.isArray(v)) return v.filter(isFileValue) as FileValue[]
  if (isFileValue(v)) return [v]
  return []
}

/** Read a `File` into a serializable `FileValue` (data URL in `uri`). */
export function fileToFileValue(file: File): Promise<FileValue> {
  const base: Omit<FileValue, "uri"> = {
    id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: file.name || "file",
    mime: file.type || "application/octet-stream",
    size: file.size,
  }
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ ...base, uri: String(reader.result ?? "") })
    reader.onerror = () => resolve({ ...base, uri: "" })
    reader.readAsDataURL(file)
  })
}

export function effectiveDef(def: AttributeDefinition): AttributeDefinition {
  return migrateAttributeDefinition(def)
}

export function slugId(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || `attr_${Date.now()}`
  )
}

/**
 * Union of the attribute schemas of the given lists. When `types` is supplied,
 * each list's schema includes its item type's attributes (see
 * `composeListAttributes`); otherwise only the list-specific attributes are
 * used (backwards-compatible).
 */
export function mergeListAttributes(
  lists: List[],
  listIds: string[] | undefined,
  types?: ItemTypeDefinition[],
): AttributeDefinition[] {
  if (!listIds || listIds.length === 0) return []
  const byId = new Map<string, AttributeDefinition>()
  listIds.forEach((cid) => {
    const cat = lists.find((c) => c.id === cid)
    if (!cat) return
    const defs = types ? composeListAttributes(cat, types) : (cat.itemAttributes ?? [])
    defs.forEach((def) => {
      const migrated = effectiveDef(def)
      if (!byId.has(migrated.id)) byId.set(migrated.id, migrated)
    })
  })
  return Array.from(byId.values())
}

/**
 * A list's *effective* attribute schema (item type's attributes + list-specific
 * extras), migrated for display. Use in list settings / table columns.
 */
export function listAttributeSchema(
  category: List,
  types: ItemTypeDefinition[],
): AttributeDefinition[] {
  return composeListAttributes(category, types).map(effectiveDef)
}

/**
 * The full attribute schema for an item: every list it belongs to (each with its
 * type's attributes) plus the item's own type attributes. Migrated for display.
 */
export function mergeItemAttributes(
  item: Pick<Task, "type" | "lists">,
  lists: List[],
  types: ItemTypeDefinition[],
): AttributeDefinition[] {
  return resolveItemSchema(item, lists, types).map(effectiveDef)
}

export function formatAttributeValue(def: AttributeDefinition, value: AttributeValue): string {
  if (value === undefined || value === null || value === "") return ""
  const d = effectiveDef(def)
  const type = normalizeAttributeType(d.type)
  switch (type) {
    case "boolean":
      return value ? "Yes" : "No"
    case "multistring":
    case "multiimage":
    case "selection":
      if (d.allowMultiple || type === "multistring" || type === "multiimage") return asArray(value).join(", ")
      return String(value)
    case "goal": {
      const g = asGoal(value)
      if (!g.target && !g.current) return ""
      return `${g.current}/${g.target}${d.unit ? " " + d.unit : ""}`
    }
    case "list":
    case "item": {
      const lists = useTaskStore.getState().lists
      const tasks = useTaskStore.getState().tasks
      if (type === "list") {
        const cat = lists.find((c) => c.id === value)
        return cat?.name || String(value)
      }
      const task = tasks.find((t) => t.id === value)
      return task?.description || String(value)
    }
    case "color":
      return String(value)
    case "file": {
      const f = asFile(value)
      return f?.name || ""
    }
    case "multifile": {
      const files = asFiles(value)
      return files.map((f) => f.name).join(", ")
    }
    case "image":
      return value ? "Image" : ""
    case "formula":
      // The value isn't stored — show the expression as a fallback. Live
      // computation happens where sibling values are available (SheetGrid).
      return d.formula ? `=${d.formula.replace(/^=/, "").trim()}` : ""
    default:
      return `${value}${d.unit ? " " + d.unit : ""}`
  }
}
