/**
 * lib/item-activity.ts — Append-only per-item activity ledger
 *
 * `lib/action-history.ts` is last-write undo (in-memory snapshots). This module
 * is the durable "what changed, when" log for a single item — plan-vs-reality
 * at the item, and the History tab on item detail. Entries are never rewritten.
 *
 * Storage: localStorage `brain2-item-activity`. A full Settings backup carries
 * this key in `extras` and writes it back on restore.
 */

import { itemTitle } from "@/lib/item-utils"
import { persistKey, readAliasedLocal, removeAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"
import type { List, Task } from "@/lib/types"

export const ITEM_ACTIVITY_STORAGE_KEY = persistKey("item-activity")
export const MAX_ACTIVITY_PER_ITEM = 200

export interface ItemActivityChange {
  field: string
  label: string
  from: string
  to: string
}

export interface ItemActivityEntry {
  id: string
  itemId: string
  at: string
  summary: string
  changes: ItemActivityChange[]
}

export interface ItemActivityLookup {
  tasks?: Task[]
  lists?: Pick<List, "id" | "name">[]
}

const FIELD_LABELS: Record<string, string> = {
  title: "Name",
  description: "Name",
  completed: "Completed",
  status: "Status",
  stage: "Stage",
  estimatedDuration: "Estimated duration",
  actualDuration: "Actual duration",
  scheduledDate: "Scheduled date",
  scheduledWeek: "Scheduled week",
  scheduledMonth: "Scheduled month",
  scheduledYear: "Scheduled year",
  deadline: "Deadline",
  dependencies: "Depends on",
  lists: "Lists",
  context: "Context",
  why: "Why",
  importance: "Importance",
  urgency: "Urgency",
  missedAt: "Missed opportunity",
}

const WATCHED_FIELDS = Object.keys(FIELD_LABELS)

function empty(): Record<string, ItemActivityEntry[]> {
  return {}
}

function readAll(): Record<string, ItemActivityEntry[]> {
  if (typeof localStorage === "undefined") return empty()
  try {
    const raw = readAliasedLocal(ITEM_ACTIVITY_STORAGE_KEY)
    if (!raw) return empty()
    const parsed = JSON.parse(raw) as Record<string, ItemActivityEntry[]>
    if (!parsed || typeof parsed !== "object") return empty()
    return parsed
  } catch {
    return empty()
  }
}

function writeAll(all: Record<string, ItemActivityEntry[]>): void {
  if (typeof localStorage === "undefined") return
  writeAliasedLocal(ITEM_ACTIVITY_STORAGE_KEY, JSON.stringify(all))
}

function stringifyScalar(value: unknown): string {
  if (value === undefined || value === null || value === "") return "(empty)"
  if (typeof value === "boolean") return value ? "yes" : "no"
  if (value instanceof Date) {
    const t = value.getTime()
    return Number.isNaN(t) ? "(empty)" : value.toLocaleDateString()
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value === "string") return value
  return String(value)
}

function titleFor(id: string, lookup?: ItemActivityLookup): string {
  const task = lookup?.tasks?.find((t) => t.id === id)
  return task ? itemTitle(task) : id
}

function listName(id: string, lookup?: ItemActivityLookup): string {
  return lookup?.lists?.find((l) => l.id === id)?.name ?? id
}

function stringifyField(field: string, value: unknown, lookup?: ItemActivityLookup): string {
  if (field === "dependencies" || field === "lists") {
    const ids = Array.isArray(value) ? (value as string[]) : []
    if (!ids.length) return "(none)"
    const names =
      field === "lists" ? ids.map((id) => listName(id, lookup)) : ids.map((id) => titleFor(id, lookup))
    return names.join(", ")
  }
  if (field === "title" || field === "description") {
    return stringifyScalar(value)
  }
  return stringifyScalar(value)
}

function getField(task: Task, field: string): unknown {
  if (field === "title") return itemTitle(task)
  return (task as unknown as Record<string, unknown>)[field]
}

/** Diff the watched fields on two item snapshots. Empty when nothing meaningful changed. */
export function diffItemActivity(
  before: Task,
  after: Task,
  lookup?: ItemActivityLookup,
): ItemActivityChange[] {
  const changes: ItemActivityChange[] = []
  const seenTitle = { skipped: false }
  for (const field of WATCHED_FIELDS) {
    if ((field === "title" || field === "description") && seenTitle.skipped) continue
    const fromRaw = getField(before, field)
    const toRaw = getField(after, field)
    const from = stringifyField(field, fromRaw, lookup)
    const to = stringifyField(field, toRaw, lookup)
    if (from === to) continue
    if (field === "title" || field === "description") seenTitle.skipped = true
    const label = FIELD_LABELS[field] ?? field
    changes.push({ field: field === "description" ? "title" : field, label, from, to })
  }
  return changes
}

function summarize(changes: ItemActivityChange[]): string {
  if (changes.length === 1) {
    const c = changes[0]
    return `${c.label}: ${c.from} → ${c.to}`
  }
  return `${changes.length} fields changed`
}

function newEntryId(): string {
  return `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Newest-first ledger for one item. */
export function listItemActivity(itemId: string): ItemActivityEntry[] {
  if (!itemId) return []
  const rows = readAll()[itemId] ?? []
  return [...rows].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
}

/** Append one entry. Caps per-item length by dropping the oldest. */
export function appendItemActivity(entry: Omit<ItemActivityEntry, "id"> & { id?: string }): ItemActivityEntry {
  const all = readAll()
  const next: ItemActivityEntry = {
    id: entry.id ?? newEntryId(),
    itemId: entry.itemId,
    at: entry.at,
    summary: entry.summary,
    changes: entry.changes,
  }
  const rows = [...(all[entry.itemId] ?? []), next]
  all[entry.itemId] = rows.length > MAX_ACTIVITY_PER_ITEM ? rows.slice(rows.length - MAX_ACTIVITY_PER_ITEM) : rows
  writeAll(all)
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ITEM_ACTIVITY_STORAGE_KEY))
    window.dispatchEvent(new Event("cogs-item-activity"))
  }
  return next
}

/**
 * If `after` differs from `before` on watched fields, append a ledger row.
 * No-op when there is nothing to record.
 */
export function recordItemWrite(
  before: Task | null | undefined,
  after: Task,
  lookup?: ItemActivityLookup,
  at: Date = new Date(),
): ItemActivityEntry | null {
  if (!after?.id || !before) return null
  const changes = diffItemActivity(before, after, lookup)
  if (!changes.length) return null
  return appendItemActivity({
    itemId: after.id,
    at: at.toISOString(),
    summary: summarize(changes),
    changes,
  })
}

/** Test helper: wipe the ledger. */
export function resetItemActivity(): void {
  if (typeof localStorage === "undefined") return
  removeAliasedLocal(ITEM_ACTIVITY_STORAGE_KEY)
}

/** Format an ISO timestamp for the History well. */
export function formatActivityWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
}
