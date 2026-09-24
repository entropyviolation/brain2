/**
 * lib/ingest/apply-inventory.ts — Pantry / fridge list used by receipt checkout
 *
 * Ordinary Items on Inventory / Pantry / Fridge — not a shadow module.
 * `inv oats` bumps a count; a receipt line that checks off grocery also bumps.
 */
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { useTaskStore } from "@/lib/task-store"
import type { List, Task } from "@/lib/types"
import { dumpReadCandidate } from "./apply-read"
import { resolveName } from "./name-resolve"
import type { ApplyResult } from "./types"

const INVENTORY_FALLBACK_NAME = "Inventory"
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
    id: "list-inventory",
    name: INVENTORY_FALLBACK_NAME,
    createdAt: new Date(),
    color: "#84cc16",
    description: "Pantry / fridge stock bumped from receipts.",
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
    if (item) return incrementQty(item, amount, now)
  }
  const task = buildInventoryItem(list.id, name, amount, now)
  useTaskStore.getState().addTask(task)
  return { id: task.id, name: itemTitleOrUntitled(task), count: amount, created: true }
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
