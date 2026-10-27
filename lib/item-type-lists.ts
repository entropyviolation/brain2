/**
 * lib/item-type-lists.ts — Item Types quick-access lists
 *
 * Lists → Quick Access → **Item Types** is a virtual folder. Each item type is
 * one virtual list. Membership is `Task.type` (and subtypes), read at display
 * time, so a new item or a recategorized item shows up without a stored
 * membership row and a second pass cannot duplicate it.
 *
 * A new row added inside one of these lists is stamped with that type. An
 * Operation or Computer Project also receives the operation stage (and, for a
 * computer project, the Project preset panels) so the Operations board can
 * open it.
 */
import type { ItemTypeDefinition, Task } from "@/lib/types"
import { itemsOfType, collectTypeDefaults } from "@/lib/item-types"
import {
  DEFAULT_OPERATION_STAGE,
  OPERATION_ATTR,
  OPERATION_TYPE_ID,
  getOperationPreset,
  operationCategoriesAttribute,
  operationPanelsAttribute,
} from "@/lib/operation-types"
import { COMPUTER_PROJECT_TYPE_ID } from "@/lib/computer-project-types"

/** Lists location id for the virtual Item Types folder. Not a stored folder. */
export const ITEM_TYPES_LOCATION = "item-types"

export const ITEM_TYPES_FOLDER_NAME = "Item Types"

export function itemTypeListLabel(type: Pick<ItemTypeDefinition, "name" | "pluralName">): string {
  const plural = type.pluralName?.trim()
  if (plural) return plural
  return type.name.endsWith("s") ? type.name : `${type.name}s`
}

/** Items whose primary type is `typeId` or a subtype of it. Not list-allowlist membership. */
export function tasksOfItemType<T extends { id: string; type?: Task["type"]; lists?: string[] }>(
  typeId: string,
  tasks: T[],
  types: ItemTypeDefinition[],
): T[] {
  return itemsOfType(typeId, tasks, [], types)
}

export function compareItemTypeLists(a: ItemTypeDefinition, b: ItemTypeDefinition): number {
  return itemTypeListLabel(a).localeCompare(itemTypeListLabel(b), undefined, { sensitivity: "base" })
}

/**
 * Stamp a brand-new list row with an item type and that type's defaults.
 * Operation-family types also get a stage so they are real operations.
 */
export function applyItemTypeToNewTask(task: Task, typeId: string, types: ItemTypeDefinition[]): Task {
  const defaults = collectTypeDefaults(typeId, types)
  const attributes: Record<string, unknown> = { ...defaults, ...(task.attributes ?? {}) }
  if (typeId === OPERATION_TYPE_ID || typeId === COMPUTER_PROJECT_TYPE_ID) {
    if (attributes[OPERATION_ATTR.stage] == null) attributes[OPERATION_ATTR.stage] = DEFAULT_OPERATION_STAGE
    if (typeId === COMPUTER_PROJECT_TYPE_ID && attributes[OPERATION_ATTR.panels] == null) {
      const preset = getOperationPreset("project")
      if (preset) {
        Object.assign(attributes, operationPanelsAttribute(preset.panels))
        if (preset.categories?.length && attributes[OPERATION_ATTR.categories] == null) {
          Object.assign(attributes, operationCategoriesAttribute(preset.categories))
        }
      }
    }
  }
  return {
    ...task,
    type: typeId,
    title: task.title || task.description,
    attributes: attributes as Task["attributes"],
  }
}
