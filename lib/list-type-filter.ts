/**
 * lib/list-type-filter.ts — Show/hide list items by item type (view-only)
 *
 * Exact type-id match for v1 (subtypes are not rolled up). Empty hidden set =
 * show all. Unknown type ids still present on rows get synthetic labels so the
 * inspector can filter them.
 */
import { BUILTIN_ITEM_TYPE_ID } from "@/lib/item-types"
import type { ItemType, ItemTypeDefinition, List, Task } from "@/lib/types"

export type TypeFilterItem = { id: string; name: string }

/** Effective type id for filter membership (exact match). */
export function effectiveItemTypeId(
  task: Pick<Task, "type">,
  openList?: Pick<List, "itemTypeId"> | null,
): string {
  const own = task.type && String(task.type).trim()
  if (own) return own
  const pinned = openList?.itemTypeId && String(openList.itemTypeId).trim()
  if (pinned) return pinned
  return BUILTIN_ITEM_TYPE_ID
}

/** Distinct effective type ids present in a task set (stable sort). */
export function typesPresentInTasks(
  tasks: Pick<Task, "type">[],
  openList?: Pick<List, "itemTypeId"> | null,
): string[] {
  const seen = new Set<string>()
  for (const task of tasks) {
    seen.add(effectiveItemTypeId(task, openList))
  }
  return [...seen].sort((a, b) => a.localeCompare(b))
}

/**
 * Checkbox rows for the inspector. Registry names when known; otherwise
 * `Unknown (id)`.
 */
export function typeFilterItems(
  typeIds: string[],
  types: ItemTypeDefinition[],
): TypeFilterItem[] {
  return typeIds.map((id) => {
    const def = types.find((t) => t.id === id)
    if (def) return { id, name: def.name }
    return { id, name: `Unknown (${id})` }
  })
}

/**
 * Display-only filter. Hidden ids omit matching rows. Membership is not
 * changed. Empty / missing hidden = show all.
 */
export function filterTasksByHiddenItemTypes<T extends Pick<Task, "type">>(
  tasks: T[],
  hiddenTypeIds: readonly string[] | undefined,
  openList?: Pick<List, "itemTypeId"> | null,
): T[] {
  if (!hiddenTypeIds?.length) return tasks
  const hidden = new Set(hiddenTypeIds.map(String))
  return tasks.filter((task) => !hidden.has(effectiveItemTypeId(task, openList)))
}

/** Whether the type filter control should appear for this open surface. */
export function shouldShowTypeFilter(opts: {
  /** Distinct effective types in the visible task set (before type filter). */
  presentTypeCount: number
  /** Allowlist size when viewing an ordinary list. */
  allowedTypeCount?: number
}): boolean {
  if (opts.presentTypeCount >= 2) return true
  if ((opts.allowedTypeCount ?? 0) >= 2) return true
  return false
}

export type { ItemType }
