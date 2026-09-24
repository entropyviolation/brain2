/**
 * lib/ingest/apply-needed.ts — Add lines onto the list named "needed"
 *
 * Bypasses Inbox. Each created item gets detail notes including "sent from text".
 */
import { createListItem, withCategoryDefaults } from "@/lib/item-utils"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { useTaskStore } from "@/lib/task-store"
import type { List } from "@/lib/types"
import type { ApplyResult } from "./types"

const NEEDED_NAME = "needed"
const SENT_FROM_TEXT = "sent from text"

export function findNeededList(): List | null {
  const lists = useTaskStore
    .getState()
    .lists.filter((list) => !isFolderAllItemsCategoryId(list.id))
  const exact = lists.find((list) => list.name.trim().toLowerCase() === NEEDED_NAME)
  return exact ?? null
}

function ensureNeededList(): List {
  const existing = findNeededList()
  if (existing) return existing
  const list: List = {
    id: `list-needed-${Date.now().toString(36)}`,
    name: NEEDED_NAME,
    color: "#78716c",
    description: "Things needed — from phone text",
    createdAt: new Date(),
  }
  useTaskStore.getState().addList(list)
  return useTaskStore.getState().lists.find((l) => l.id === list.id) ?? list
}

export function applyNeeded(payload: string, now = new Date()): ApplyResult {
  const text = payload.trim()
  if (!text) {
    return {
      status: "error",
      kind: "needed",
      reply: "Nothing added. Example: get:\nbatteries  ·  needed: batteries",
    }
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean)
  if (lines.length === 0) {
    return {
      status: "error",
      kind: "needed",
      reply: "Nothing added. Example: get:\nbatteries  ·  needed: batteries",
    }
  }

  const list = ensureNeededList()
  const itemIds: string[] = []
  const titles: string[] = []
  for (const line of lines) {
    const base = withCategoryDefaults(createListItem(line, [list.id]), list)
    const task = {
      ...base,
      notes: mergeNotes(base.notes, SENT_FROM_TEXT),
      createdAt: now,
    }
    useTaskStore.getState().addTask(task)
    itemIds.push(task.id)
    titles.push(line)
  }

  const label = titles.length === 1 ? titles[0] : titles.join(", ")
  return {
    status: "ok",
    kind: "needed",
    reply: `Needed: ${label}`,
    summary: `Needed → ${label}`,
    itemIds,
  }
}

function mergeNotes(existing: string | undefined, line: string): string {
  const prev = (existing ?? "").trim()
  if (!prev) return line
  if (prev.toLowerCase().includes(line.toLowerCase())) return prev
  return `${prev}\n${line}`
}
