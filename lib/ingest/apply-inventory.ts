/**
 * lib/ingest/apply-inventory.ts — Pantry / fridge list used by receipt checkout
 *
 * Ordinary Items on Inventory / Pantry / Fridge — not a shadow module.
 * `inv oats` bumps a count; a receipt line that checks off grocery also bumps.
 * The same bump writes a pantry lot on `brain2-kitchen`.
 */
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { useTaskStore } from "@/lib/task-store"
import type { List, Task } from "@/lib/types"
import { matchCatalog } from "@/lib/kitchen-catalog"
import { notePantryBuy, resolveKitchenFood, useKitchenStore } from "@/lib/kitchen-store"
import { dumpReadCandidate } from "./apply-read"
import { resolveName } from "./name-resolve"
import type { ApplyResult } from "./types"

const INVENTORY_FALLBACK_NAME = "Inventory"
/** Id of the Inventory list this module creates when none exists. */
export const INVENTORY_LIST_ID = "list-inventory"
export const INVENTORY_QTY_ATTR = "qty"

export function inventoryScore(name: string): number {
  const n = name.trim().toLowerCase()
  if (n === "inventory" || n === "pantry" || n === "fridge") return 4
  if (/\binventory\b/.test(n)) return 3
  if (/\bpantry\b|\bfridge\b|\brefrigerator\b/.test(n)) return 2
  return 0
}

export function findInventoryList(): List | null {
  const lists = useTaskStore
    .getState()
    .lists.filter((list) => !isFolderAllItemsCategoryId(list.id))
  const ranked = lists
    .map((list) => ({ list, score: inventoryScore(list.name) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.list.name.localeCompare(b.list.name))
  return ranked[0]?.list ?? null
}

export function ensureInventoryList(): List {
  const existing = findInventoryList()
  if (existing) return existing
  const list: List = {
    id: INVENTORY_LIST_ID,
    name: INVENTORY_FALLBACK_NAME,
    createdAt: new Date(),
    color: "#84cc16",
    description: "Pantry / fridge stock bumped from receipts.",
    scheduleable: false,
  }
  useTaskStore.getState().addList(list)
  return list
}

export function inventoryDumpText(): string | null {
  const list = findInventoryList()
  if (!list) return null
  const dumped = dumpReadCandidate(`list:${list.id}`)
  return dumped.status === "ok" ? dumped.reply : null
}

export function applyInventory(payload: string, now = new Date()): ApplyResult {
  const text = payload.trim()
  if (!text) {
    const dumped = inventoryDumpText()
    if (!dumped) {
      return {
        status: "ok",
        kind: "inventory",
        reply: "No inventory list yet. Text inv oats — or snap a receipt.",
        summary: "No inventory list",
      }
    }
    return { status: "ok", kind: "inventory", reply: dumped, summary: "Inventory dump" }
  }

  const names = text
    .split(/[\n,]+/)
    .map((part) => part.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean)
  const bumped = names.map((name) => bumpInventory(name, 1, now))
  const bits = bumped.map((row) => `${row.name} ×${row.count}`)
  return {
    status: "ok",
    kind: "inventory",
    reply: `Pantry: ${bits.join(", ")}.`,
    summary: `Inventory ${bits.join(", ")}`,
    itemIds: bumped.map((row) => row.id),
  }
}

export function bumpInventory(
  name: string,
  qty = 1,
  now = new Date(),
): { id: string; name: string; count: number; created: boolean } {
  const list = ensureInventoryList()
  const amount = Number.isFinite(qty) && qty > 0 ? qty : 1
  const items = useTaskStore.getState().tasks.filter((task) => task.lists?.includes(list.id))
  const named = items.map((item) => ({ id: item.id, name: itemTitleOrUntitled(item) }))
  const hit = resolveName(name, named)
  if (hit.status === "match") {
    const item = items.find((row) => row.id === hit.candidate.id)
    if (item) {
      const row = incrementQty(item, amount, now)
      notePantryBuy(name, amount, now)
      return row
    }
  }
  const task = buildInventoryItem(list.id, name, amount, now)
  useTaskStore.getState().addTask(task)
  notePantryBuy(name, amount, now)
  return { id: task.id, name: itemTitleOrUntitled(task), count: amount, created: true }
}

/** Inventory list names that are not already a kitchen lot. */
export function inventoryOffers(): { name: string; qty: number }[] {
  const list = findInventoryList()
  if (!list) return []
  const kitchen = useKitchenStore.getState()
  const stockIds = new Set(kitchen.stock.map((lot) => lot.foodId))
  const have = new Set(
    kitchen.stock.map((lot) => (resolveKitchenFood(lot.foodId, kitchen.foods)?.name || "").trim().toLowerCase()).filter(Boolean),
  )
  const out: { name: string; qty: number }[] = []
  for (const item of useTaskStore.getState().tasks) {
    if (!item.lists?.includes(list.id) || item.completed) continue
    const name = itemTitleOrUntitled(item)
    const catalog = matchCatalog(name)
    if (!name.trim() || have.has(name.trim().toLowerCase()) || (catalog && stockIds.has(catalog.id))) continue
    const qty = Number(item.attributes?.[INVENTORY_QTY_ATTR])
    out.push({ name, qty: Number.isFinite(qty) && qty > 0 ? qty : 1 })
  }
  return out
}

function incrementQty(item: Task, amount: number, now: Date) {
  const current = Number(item.attributes?.[INVENTORY_QTY_ATTR])
  const count = (Number.isFinite(current) && current > 0 ? current : 1) + amount
  useTaskStore.getState().updateTask({
    ...item,
    completed: false,
    attributes: {
      ...(item.attributes ?? {}),
      [INVENTORY_QTY_ATTR]: count,
      inventoryUpdatedAt: now.toISOString(),
    },
  })
  return { id: item.id, name: itemTitleOrUntitled(item), count, created: false }
}

function buildInventoryItem(listId: string, name: string, qty: number, now: Date): Task {
  return {
    id: `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    description: name.trim() || "item",
    stage: "list",
    createdAt: now,
    completed: false,
    lists: [listId],
    attributes: {
      [INVENTORY_QTY_ATTR]: qty,
      inventoryUpdatedAt: now.toISOString(),
    },
    links: [],
    tags: ["inventory"],
  }
}
