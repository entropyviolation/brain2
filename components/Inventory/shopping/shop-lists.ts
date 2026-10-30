/**
 * components/Inventory/shopping/shop-lists.ts — Shopping list guesses
 *
 * A shopping list is a named view. It can draw from several vault lists.
 * The first visit still starts from Grocery, Shopping, Wish list, and Wanted.
 * Grocery prefers `list-inventory`. A guess never puts two views on the same
 * list. Creating a row uses `createListItem` so the title and `lists`
 * membership are a real item.
 */
import { LIST_TEMPLATES } from "@/components/Lists/constants"
import { INVENTORY_LIST_ID, INVENTORY_QTY_ATTR } from "@/lib/ingest/apply-inventory"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { createListItem } from "@/lib/item-utils"
import type { List } from "@/lib/types"

export const SHOP_SECTION_IDS = ["grocery", "shopping", "wish", "wanted"] as const

export type ShopSectionId = (typeof SHOP_SECTION_IDS)[number]

/** One switcher key. `listIds` are the vault lists aggregated under that name. */
export interface ShopView {
  id: string
  name: string
  listIds: string[]
}

export const SHOP_SECTIONS: readonly { id: ShopSectionId; label: string; defaultName: string }[] = [
  { id: "grocery", label: "Grocery", defaultName: "Grocery" },
  { id: "shopping", label: "Shopping", defaultName: "Shopping" },
  { id: "wish", label: "Wish list", defaultName: "Wish list" },
  { id: "wanted", label: "Wanted", defaultName: "Wanted" },
]

const SECTION_COLOR: Record<ShopSectionId, string> = {
  grocery: "#6b8f71",
  shopping: "#3d6b8a",
  wish: "#8a5a7a",
  wanted: "#8a623d",
}

const GROCERY_NAME = /grocery/i
const SHOPPING_NAME = /shopping/i
const WISH_NAME = /wish/i
const WANTED_NAME = /wanted|want list|to buy/i

export interface NamedList {
  id: string
  name: string
}

export function defaultShopViews(): ShopView[] {
  return SHOP_SECTIONS.map((row) => ({ id: row.id, name: row.label, listIds: [] }))
}

export function shopSectionId(id: string): ShopSectionId | null {
  return (SHOP_SECTION_IDS as readonly string[]).includes(id) ? (id as ShopSectionId) : null
}

function uniqueStrings(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    const next = id.trim()
    if (!next || seen.has(next)) continue
    seen.add(next)
    out.push(next)
  }
  return out
}

/** Drop blank or repeated views. A stored record with no usable views is empty. */
export function cleanShopViews(raw: unknown): ShopView[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: ShopView[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const item = row as Record<string, unknown>
    const id = typeof item.id === "string" ? item.id.trim() : ""
    const name = typeof item.name === "string" ? item.name.trim() : ""
    if (!id || !name || seen.has(id)) continue
    const listIds = Array.isArray(item.listIds) ? uniqueStrings(item.listIds.filter((value): value is string => typeof value === "string")) : []
    seen.add(id)
    out.push({ id, name, listIds })
  }
  return out
}

/**
 * Version 2 stores `{ v: 2, views }`. The older record is one list id per
 * section, and an empty string is an explicit unbound section.
 */
export function shopViewsFromStored(raw: unknown): ShopView[] | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  if (record.v === 2) {
    const views = cleanShopViews(record.views)
    return views.length > 0 ? views : defaultShopViews()
  }
  const legacy = SHOP_SECTION_IDS.some((id) => typeof record[id] === "string")
  if (!legacy) return null
  return defaultShopViews().map((view) => {
    const value = record[view.id]
    return { ...view, listIds: typeof value === "string" && value ? [value] : [] }
  })
}

/** A new switcher key. An empty name does not submit. */
export function shopViewDraft(name: string, now = new Date()): ShopView | null {
  const label = name.trim()
  if (!label) return null
  return {
    id: `shop-view-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: label,
    listIds: [],
  }
}

export function shopCatalogLists<T extends { id: string }>(lists: readonly T[]): T[] {
  return lists.filter((list) => list.id.length > 0 && !isFolderAllItemsCategoryId(list.id))
}

/**
 * Fill only views that have no sources yet. Grocery takes `list-inventory`
 * when that list exists, otherwise a grocery name. Shopping skips whatever
 * grocery took. Wish and wanted then take the first unused name match.
 * A view that already has sources is left alone, including extra sources.
 */
export function autoPickShopLists(lists: readonly NamedList[], views: readonly ShopView[]): ShopView[] {
  const next = views.map((view) => ({ ...view, listIds: [...view.listIds] }))
  const used = new Set(next.flatMap((view) => view.listIds))

  const take = (section: ShopSectionId, hit: NamedList | undefined) => {
    const view = next.find((row) => row.id === section)
    if (!view || view.listIds.length > 0 || !hit || used.has(hit.id)) return
    view.listIds = [hit.id]
    used.add(hit.id)
  }

  if (!next.find((view) => view.id === "grocery")?.listIds.length) {
    take(
      "grocery",
      lists.find((list) => list.id === INVENTORY_LIST_ID && !used.has(list.id)) ??
        lists.find((list) => GROCERY_NAME.test(list.name) && !used.has(list.id)),
    )
  }
  const groceryId = next.find((view) => view.id === "grocery")?.listIds[0]
  if (!next.find((view) => view.id === "shopping")?.listIds.length) {
    take(
      "shopping",
      lists.find((list) => SHOPPING_NAME.test(list.name) && list.id !== groceryId && !used.has(list.id)),
    )
  }
  if (!next.find((view) => view.id === "wish")?.listIds.length) {
    take(
      "wish",
      lists.find((list) => WISH_NAME.test(list.name) && !used.has(list.id)),
    )
  }
  if (!next.find((view) => view.id === "wanted")?.listIds.length) {
    take(
      "wanted",
      lists.find((list) => WANTED_NAME.test(list.name) && !used.has(list.id)),
    )
  }
  return next
}

/** Items on any of the source lists, once each, in vault order. */
export function shopAggregate<T extends { id: string; lists?: string[] | null }>(tasks: readonly T[], listIds: readonly string[]): T[] {
  const want = new Set(listIds.filter((id) => id.length > 0))
  if (want.size === 0) return []
  const seen = new Set<string>()
  const rows: T[] = []
  for (const task of tasks) {
    if (!task.id || seen.has(task.id)) continue
    if (!task.lists?.some((id) => want.has(id))) continue
    seen.add(task.id)
    rows.push(task)
  }
  return rows
}

/** Real item for one list. Empty names and a missing list id do not submit. */
export function shopAddItem(title: string, listId: string) {
  const name = title.trim()
  if (!name || !listId) return null
  return createListItem(name, [listId])
}

export function shopListDraft(section: ShopSectionId, now = new Date()): List {
  const meta = SHOP_SECTIONS.find((row) => row.id === section) ?? SHOP_SECTIONS[0]
  const list: List = {
    id: `shop-${section}-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: meta.defaultName,
    color: SECTION_COLOR[section],
    createdAt: now,
    scheduleable: false,
  }
  if (section === "shopping") {
    list.itemAttributes = LIST_TEMPLATES.shopping.attributes.map((attr) => ({
      ...attr,
      options: attr.options ? [...attr.options] : undefined,
    }))
  }
  return list
}

/** A vault list for a shopping view the person named themselves. */
export function shopListDraftNamed(name: string, now = new Date()): List {
  return {
    id: `shop-list-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || "Shopping",
    color: SECTION_COLOR.shopping,
    createdAt: now,
    scheduleable: false,
  }
}

/** Quantity from the grocery attribute, then a standing note, when the item has one. */
export function shopRowAside(item: { notes?: string | null; attributes?: Record<string, unknown> | null }): string {
  const raw = item.attributes?.[INVENTORY_QTY_ATTR]
  const qty = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : Number.NaN
  const qtyText = Number.isFinite(qty) && qty > 0 ? `×${qty}` : ""
  const note = typeof item.notes === "string" ? item.notes.trim() : ""
  return [qtyText, note].filter(Boolean).join(" · ")
}
