/**
 * lib/ingest/apply-grocery.ts — Fast grocery dump / add / checkout from the phone
 *
 * `groc` dumps the grocery-ish list and pins it. `groc milk` files onto that list
 * (Inbox off). `got milk` / `x eggs` completes matching open lines.
 */
import { completeTask } from "@/lib/services/completion-service"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import type { List, Task } from "@/lib/types"
import { applyBulk } from "./apply-bulk"
import { dumpReadCandidate } from "./apply-read"
import { resolveName } from "./name-resolve"
import type { ApplyResult, NameCandidate } from "./types"

const GROCERY_FALLBACK_NAME = "Grocery list"

function groceryScore(name: string): number {
  const n = name.trim().toLowerCase()
  if (n === "grocery list" || n === "grocery" || n === "groceries") return 4
  if (/\bgrocery list\b/.test(n)) return 3
  if (/\bgrocery\b|\bgroceries\b/.test(n)) return 2
  if (/\bshopping\b/.test(n)) return 1
  return 0
}

/** True for Grocery list / Groceries, not a mere Shopping list. */
export function isGroceryListName(name: string): boolean {
  return groceryScore(name) >= 2
}

export function findGroceryList(): List | null {
  const lists = useTaskStore
    .getState()
    .lists.filter((list) => !isFolderAllItemsCategoryId(list.id))
  const ranked = lists
    .map((list) => ({ list, score: groceryScore(list.name) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.list.name.localeCompare(b.list.name))
  return ranked[0]?.list ?? null
}

export function groceryDumpText(): string | null {
  const list = findGroceryList()
  if (!list) return null
  const dumped = dumpReadCandidate(`list:${list.id}`)
  return dumped.status === "ok" ? dumped.reply : null
}

export function applyGrocery(payload: string, now = new Date()): ApplyResult {
  const text = payload.trim()
  if (!text) return dumpOrEmpty()

  const list = findGroceryList()
  const name = list?.name ?? GROCERY_FALLBACK_NAME
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean)

  const result = applyBulk(`${name}:\n${lines.join("\n")}`, { sendToInbox: false, now })
  if (result.status !== "ok" && result.status !== "needs_clarify") return result
  return withGroceryPin({ ...result, kind: "grocery" })
}

export function applyBought(payload: string, now = new Date()): ApplyResult {
  const text = payload.trim()
  if (!text) {
    return {
      status: "error",
      kind: "bought",
      reply: "Got what? Example: got milk  or  x eggs, bread",
    }
  }
  const list = findGroceryList()
  if (!list) {
    return { status: "error", kind: "bought", reply: "No grocery list yet. Text groc milk to start one." }
  }

  const queries = splitBoughtQueries(text)
  const open = openItemsOn(list.id)
  if (open.length === 0) {
    return withGroceryPin({
      status: "ok",
      kind: "bought",
      reply: `${list.name} is already empty.`,
      summary: "Grocery already empty",
    })
  }

  const got: string[] = []
  const missing: string[] = []
  let pending: ApplyResult | null = null

  for (const query of queries) {
    const named = open
      .filter((item) => !got.includes(item.id))
      .map((item) => ({ id: item.id, name: itemTitleOrUntitled(item) }))
    const hit = resolveName(query, named)
    if (hit.status === "match") {
      completeTask(hit.candidate.id)
      got.push(hit.candidate.id)
      continue
    }
    if (hit.status === "ambiguous") {
      pending = clarifyBought(query, hit.candidates, now)
      break
    }
    missing.push(query)
  }

  if (pending) return pending

  const names = got
    .map((id) => {
      const item = useTaskStore.getState().tasks.find((t) => t.id === id)
      return item ? itemTitleOrUntitled(item) : id
    })
    .filter(Boolean)
  const bits = [
    names.length ? `Got ${names.join(", ")}.` : null,
    missing.length ? `Not on the list: ${missing.join(", ")}.` : null,
  ].filter(Boolean)
  if (!bits.length) {
    return { status: "error", kind: "bought", reply: `Nothing matching “${text}” on ${list.name}.` }
  }
  return withGroceryPin({
    status: "ok",
    kind: "bought",
    reply: bits.join(" "),
    summary: names.length ? `Bought ${names.join(", ")}` : `Missed ${missing.join(", ")}`,
    itemIds: got,
  })
}

export function applyBoughtCandidate(itemId: string): ApplyResult {
  const item = useTaskStore.getState().tasks.find((t) => t.id === itemId)
  if (!item || item.completed) {
    return { status: "error", kind: "bought", reply: "That line disappeared. Send groc." }
  }
  completeTask(item.id)
  return withGroceryPin({
    status: "ok",
    kind: "bought",
    reply: `Got ${itemTitleOrUntitled(item)}.`,
    summary: `Bought ${itemTitleOrUntitled(item)}`,
    itemIds: [item.id],
  })
}

function dumpOrEmpty(): ApplyResult {
  const list = findGroceryList()
  if (!list) {
    return {
      status: "ok",
      kind: "grocery",
      reply: "No grocery list yet. Text groc milk to start Grocery list.",
      summary: "No grocery list",
    }
  }
  const dumped = dumpReadCandidate(`list:${list.id}`)
  if (dumped.status !== "ok") return dumped
  return { ...dumped, kind: "grocery", pinText: dumped.reply }
}

function withGroceryPin(result: ApplyResult): ApplyResult {
  if (result.status !== "ok" && result.status !== "needs_clarify") return result
  const pinText = groceryDumpText() ?? undefined
  if (!pinText) return result
  return { ...result, pinText }
}

function openItemsOn(listId: string): Task[] {
  return useTaskStore
    .getState()
    .tasks.filter((task) => task.lists?.includes(listId) && !task.completed)
}

function splitBoughtQueries(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((part) => part.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean)
}

function clarifyBought(query: string, candidates: NameCandidate[], now: Date): ApplyResult {
  const list = candidates.map((c, i) => `${i + 1}. ${c.name}`).join("\n")
  return {
    status: "needs_clarify",
    kind: "bought",
    reply: `Which grocery line for “${query}”?\n${list}`,
    pending: {
      kind: "bought",
      query,
      candidates,
      createdAt: now.toISOString(),
    },
  }
}
