/**
 * lib/list-item-types.ts — Per-list item-type allowlist + default
 *
 * `List.itemTypeId` stays the default type for new rows (`withListMembership`).
 * `List.itemTypeIds` is the allowlist of types assigned to the list. Missing /
 * empty allowlist with a default means “just that default”; missing both means
 * no assigned types (generic items).
 */
import type { ItemType, List } from "@/lib/types"

/** Normalize an allowlist: unique non-empty string ids, or undefined when empty. */
export function sanitizeListItemTypeIds(value: unknown): ItemType[] | undefined {
  if (!Array.isArray(value)) return undefined
  const seen = new Set<string>()
  const out: ItemType[] = []
  for (const raw of value) {
    if (typeof raw !== "string") continue
    const id = raw.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out.length > 0 ? out : undefined
}

/**
 * Effective allowlist for a list. Prefer explicit `itemTypeIds`; otherwise the
 * single `itemTypeId` default; otherwise empty.
 */
export function listAllowedTypeIds(list: {
  itemTypeId?: ItemType
  itemTypeIds?: ItemType[]
}): ItemType[] {
  const explicit = sanitizeListItemTypeIds(list.itemTypeIds)
  if (explicit) return explicit
  if (list.itemTypeId && String(list.itemTypeId).trim()) return [list.itemTypeId]
  return []
}

/** True when the list assigns at least two types (filter / multi-type UI). */
export function listHasMultipleAllowedTypes(list: {
  itemTypeId?: ItemType
  itemTypeIds?: ItemType[]
}): boolean {
  return listAllowedTypeIds(list).length >= 2
}

/**
 * Keep default inside the allowlist. If the default is cleared from the
 * allowlist, pick the first remaining type (or clear default).
 */
export function normalizeListTypeAssignment(list: List): List {
  const allowed = listAllowedTypeIds(list)
  const defaultId = list.itemTypeId && String(list.itemTypeId).trim() ? list.itemTypeId : undefined
  if (allowed.length === 0) {
    if (!list.itemTypeId && !list.itemTypeIds) return list
    return { ...list, itemTypeId: undefined, itemTypeIds: undefined }
  }
  const nextDefault = defaultId && allowed.includes(defaultId) ? defaultId : allowed[0]
  const nextIds = sanitizeListItemTypeIds(allowed)
  if (list.itemTypeId === nextDefault && sameIds(list.itemTypeIds, nextIds)) return list
  return { ...list, itemTypeId: nextDefault, itemTypeIds: nextIds }
}

function sameIds(a: ItemType[] | undefined, b: ItemType[] | undefined): boolean {
  const aa = a ?? []
  const bb = b ?? []
  if (aa.length !== bb.length) return false
  return aa.every((id, i) => id === bb[i])
}

/** Toggle a type on/off the allowlist; keeps default coherent. */
export function toggleListAllowedType(list: List, typeId: ItemType, on: boolean): List {
  const id = String(typeId).trim()
  if (!id) return list
  const current = new Set(listAllowedTypeIds(list).map(String))
  if (on) current.add(id)
  else current.delete(id)
  const itemTypeIds = sanitizeListItemTypeIds([...current])
  // Clearing the last allowlist entry must also clear the default, or
  // `listAllowedTypeIds` would fall back to `itemTypeId` and resurrect it.
  return normalizeListTypeAssignment({
    ...list,
    itemTypeIds,
    itemTypeId: itemTypeIds ? list.itemTypeId : undefined,
  })
}

/** Add a type to the allowlist and optionally make it the default for new items. */
export function assignTypeToList(list: List, typeId: ItemType, asDefault = true): List {
  const id = String(typeId).trim()
  if (!id) return list
  const allowed = new Set(listAllowedTypeIds(list).map(String))
  allowed.add(id)
  return normalizeListTypeAssignment({
    ...list,
    itemTypeIds: sanitizeListItemTypeIds([...allowed]),
    itemTypeId: asDefault ? id : list.itemTypeId,
  })
}

/** Set the default type for new items; must already be on the allowlist (or becomes it). */
export function setListDefaultItemType(list: List, typeId: ItemType | undefined): List {
  if (!typeId) {
    return normalizeListTypeAssignment({ ...list, itemTypeId: undefined })
  }
  return assignTypeToList(list, typeId, true)
}
