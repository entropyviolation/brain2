/**
 * lib/tracking-lists.ts — Tracking folder, Thought Process list, Log list
 *
 * The folder and both lists are created once the vault has hydrated. A list
 * already named Thought Process or Log is adopted the first time, so the
 * Quick Add list that colon-capture used to open is the same list.
 *
 * A log row the classifier accepts is also one pointer. Thought process and
 * log events sit on those two lists. Food, drink, drug, intake, notes,
 * switches, and spends use the subtype as `type` and `lists: []`. The item
 * id is `tracking-entry-` plus the time-entry id. One count is
 * `count-item-` plus the count id (`trackingEntryId` holds that id). A
 * delete stays deleted (`removedTaskIds`). A removed Shower is not recreated.
 * Painted intervals are not items. The time-grid row stays the source.
 */
import { createListItem } from "@/lib/item-utils"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { SHOWER_COUNT_ID, useCountStatusesStore } from "@/lib/count-statuses"
import { LOG_COUNT_TYPE_ID } from "@/lib/log-item-types"
import { countItemId, logItemTypeIdForEntry, type LogItemTypeId } from "@/lib/log-item-role"
import { entryClockCertainty, minutesToLabel, type TimeEntry } from "@/lib/time-entries"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import {
  LOG_TYPE_ID,
  THOUGHT_PROCESS_TYPE_ID,
  TRACKING_ITEM_ATTR,
} from "@/lib/tracking-item-types"
import type { Folder, List, Task } from "@/lib/types"

/** Same `eventKind` `applyThoughtProcess` writes. Kept here so this file does not import that writer. */
const THOUGHT_PROCESS_KIND = "thought-process"

export const TRACKING_FOLDER_ID = "folder-tracking"
export const TRACKING_FOLDER_NAME = "Tracking"
export const THOUGHT_PROCESS_LIST_ID = "list-tracking-thought-process"
export const THOUGHT_PROCESS_LIST_NAME = "Thought Process"
export const LOG_LIST_ID = "list-tracking-log"
export const LOG_LIST_NAME = "Log"

const TEXT_LOG_PEN = "text log"

const NOT_A_LOG = new Set([
  THOUGHT_PROCESS_KIND,
  "spend",
  "switch",
  "switch-task",
  "switch-objective",
  "intake",
  "intake.food",
  "intake.drink",
  "intake.drug",
])

export function trackingItemId(entryId: string): string {
  return `tracking-entry-${entryId}`
}

function sameName(name: string | undefined, wanted: string): boolean {
  return (name ?? "").trim().toLowerCase() === wanted.toLowerCase()
}

function protectedList(list: List): boolean {
  return Boolean(
    isFolderAllItemsCategoryId(list.id) ||
      list.peopleList ||
      list.reminderList ||
      list.instagramFollowingList ||
      list.instagramFollowersList ||
      list.instagramAnalysisList ||
      list.createdByModuleId,
  )
}

function listShell(id: string, name: string, typeId: string, label: string, color: string, description: string): List {
  return {
    id,
    name,
    color,
    description,
    createdAt: new Date(),
    itemLabel: label,
    itemTypeId: typeId,
    itemTypeIds: [typeId],
    scheduleable: false,
    displayedAttributes:
      typeId === LOG_TYPE_ID
        ? [TRACKING_ITEM_ATTR.when, TRACKING_ITEM_ATTR.clock, TRACKING_ITEM_ATTR.eventKind]
        : [TRACKING_ITEM_ATTR.when, TRACKING_ITEM_ATTR.clock],
  }
}

/** Move items and folder membership off `fromId` onto `toId`. */
function retargetList(fromId: string, toId: string, typeId: string): void {
  const state = useTaskStore.getState()
  let changed = false
  const tasks = state.tasks.map((task) => {
    if (!task.lists?.includes(fromId)) return task
    changed = true
    const lists = task.lists.filter((id) => id !== fromId)
    if (!lists.includes(toId)) lists.push(toId)
    const type = !task.type || task.type === "item" ? typeId : task.type
    return { ...task, lists, type }
  })
  if (changed) state.setTasks(tasks)
  for (const folder of useTaskStore.getState().folders) {
    if (!folder.listIds.includes(fromId)) continue
    const listIds = [...new Set(folder.listIds.map((id) => (id === fromId ? toId : id)))]
    const live = useTaskStore.getState().folders.find((row) => row.id === folder.id)
    if (live) useTaskStore.getState().updateFolder({ ...live, listIds })
  }
}

function claimList(id: string, name: string, typeId: string, label: string, color: string, description: string): string {
  const store = useTaskStore.getState()
  const canonical = store.lists.find((list) => list.id === id)
  const named = store.lists.find((list) => list.id !== id && sameName(list.name, name) && !protectedList(list))
  if (!canonical && named) {
    store.addList({
      ...named,
      id,
      name,
      color: named.color || color,
      description: named.description || description,
      itemLabel: label,
      itemTypeId: typeId,
      itemTypeIds: named.itemTypeIds?.includes(typeId) ? named.itemTypeIds : [typeId],
      scheduleable: false,
    })
    retargetList(named.id, id, typeId)
    useTaskStore.getState().deleteList(named.id)
    return id
  }
  if (!canonical) {
    store.addList(listShell(id, name, typeId, label, color, description))
    return id
  }
  if (!canonical.itemTypeId || canonical.itemTypeId === "item") {
    store.updateList({
      ...canonical,
      itemTypeId: typeId,
      itemTypeIds: canonical.itemTypeIds?.length ? canonical.itemTypeIds : [typeId],
      itemLabel: canonical.itemLabel || label,
      scheduleable: canonical.scheduleable ?? false,
    })
  }
  return id
}

function ensureFolder(thoughtId: string, logId: string): void {
  const store = useTaskStore.getState()
  const existing = store.folders.find((folder) => folder.id === TRACKING_FOLDER_ID)
  const listIds = [thoughtId, logId]
  if (!existing) {
    const folder: Folder = {
      id: TRACKING_FOLDER_ID,
      name: TRACKING_FOLDER_NAME,
      createdAt: new Date(),
      listIds,
      color: "#1a3a5c",
      description: "Thought Process and Log from the tracking log, Quick Add, and BIM.",
      scheduleable: false,
    }
    store.addFolder(folder)
    return
  }
  const missing = listIds.filter((id) => !existing.listIds.includes(id))
  if (missing.length === 0 && existing.name === TRACKING_FOLDER_NAME) return
  store.updateFolder({
    ...existing,
    name: existing.name || TRACKING_FOLDER_NAME,
    listIds: [...existing.listIds, ...missing],
  })
}

/** Create Tracking → Thought Process and Log. Safe to call more than once. */
export function ensureTrackingLists(): { thoughtListId: string; logListId: string } {
  const thoughtListId = claimList(
    THOUGHT_PROCESS_LIST_ID,
    THOUGHT_PROCESS_LIST_NAME,
    THOUGHT_PROCESS_TYPE_ID,
    "thought",
    "#3d6b8a",
    "Thought process rows from the tracking log, Quick Add, and BIM.",
  )
  const logListId = claimList(
    LOG_LIST_ID,
    LOG_LIST_NAME,
    LOG_TYPE_ID,
    "log",
    "#1a3a5c",
    "Log rows from the tracking log, Quick Add, and BIM.",
  )
  ensureFolder(thoughtListId, logListId)
  return { thoughtListId, logListId }
}

function penName(entry: TimeEntry): string {
  const store = useTimeTrackingStore.getState()
  const scope = store.scopes.find((row) => row.id === entry.scopeId)
  return scope?.pens.find((pen) => pen.id === entry.penId)?.name ?? ""
}

/** Thought process, log event, or neither. Notes and other shelves are neither. */
export function trackingListRole(entry: TimeEntry): "thought-process" | "log" | null {
  if (entry.scopeId !== "activity") return null
  const kind = entry.eventKind?.trim()
  if (!kind) return null
  if (kind === THOUGHT_PROCESS_KIND) return "thought-process"
  if (NOT_A_LOG.has(kind) || kind.startsWith("intake.") || entry.switchTo || entry.spendAmount != null) return null
  const textPen = penName(entry).trim().toLowerCase() === TEXT_LOG_PEN
  const fromText = entry.generatedBy?.kind === "text"
  if (!textPen && !fromText) return null
  return "log"
}

function whenLabel(entry: TimeEntry): string {
  const clock = entryClockCertainty(entry)
  if (clock === "unknown") return `${entry.date} · unknown`
  const start = minutesToLabel(entry.startMin)
  const ranged = entry.kind !== "instant" && entry.endMin > entry.startMin
  const end = ranged ? `–${minutesToLabel(entry.endMin === 1440 ? 0 : entry.endMin)}` : ""
  const mark = clock === "estimated" ? "~" : ""
  return `${entry.date} · ${mark}${start}${end}`
}

function userNote(notes: string | undefined): string | undefined {
  if (!notes?.trim()) return undefined
  const lines = notes
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^from text\b/i.test(line))
  return lines.length ? lines.join("\n") : undefined
}

function itemFromEntry(entry: TimeEntry, role: "thought-process" | "log", listId: string): Task {
  const title = (entry.title ?? "").trim() || "Untitled"
  const base = createListItem(title, [listId])
  const [year, month, day] = entry.date.split("-").map(Number)
  const createdAt =
    year && month && day
      ? new Date(year, month - 1, day, Math.floor(entry.startMin / 60), entry.startMin % 60, 0, 0)
      : new Date()
  const note = userNote(entry.notes)
  return {
    ...base,
    id: trackingItemId(entry.id),
    type: role === "thought-process" ? THOUGHT_PROCESS_TYPE_ID : LOG_TYPE_ID,
    title,
    description: title,
    createdAt,
    rewardValue: 0,
    ...(note ? { notes: note } : {}),
    attributes: {
      [TRACKING_ITEM_ATTR.when]: whenLabel(entry),
      [TRACKING_ITEM_ATTR.clock]: entryClockCertainty(entry),
      [TRACKING_ITEM_ATTR.eventKind]: entry.eventKind ?? "",
      [TRACKING_ITEM_ATTR.entryId]: entry.id,
    },
  }
}

function pointerAttributes(entry: TimeEntry, entryId: string): NonNullable<Task["attributes"]> {
  return {
    [TRACKING_ITEM_ATTR.when]: whenLabel(entry),
    [TRACKING_ITEM_ATTR.clock]: entryClockCertainty(entry),
    [TRACKING_ITEM_ATTR.eventKind]: entry.eventKind ?? "",
    [TRACKING_ITEM_ATTR.entryId]: entryId,
  }
}

/** Subtype pointer. Not placed on the Log or Thought Process list. */
function itemFromSubtype(entry: TimeEntry, typeId: LogItemTypeId): Task {
  const title = (entry.title ?? "").trim() || "Untitled"
  const base = createListItem(title, [])
  const [year, month, day] = entry.date.split("-").map(Number)
  const createdAt =
    year && month && day
      ? new Date(year, month - 1, day, Math.floor(entry.startMin / 60), entry.startMin % 60, 0, 0)
      : new Date()
  const note = userNote(entry.notes)
  return {
    ...base,
    id: trackingItemId(entry.id),
    type: typeId,
    title,
    description: title,
    createdAt,
    rewardValue: 0,
    lists: [],
    ...(note ? { notes: note } : {}),
    attributes: pointerAttributes(entry, entry.id),
  }
}

/** One count. Ticks stay in the count store. */
function itemFromCount(count: { id: string; name: string }): Task {
  const title = count.name.trim()
  const base = createListItem(title, [])
  return {
    ...base,
    id: countItemId(count.id),
    type: LOG_COUNT_TYPE_ID,
    title,
    description: title,
    rewardValue: 0,
    lists: [],
    attributes: {
      [TRACKING_ITEM_ATTR.entryId]: count.id,
    },
  }
}

function entryPointerWanted(entry: TimeEntry): LogItemTypeId | null {
  if (entry.kind !== "instant") return null
  if (!(entry.title ?? "").trim()) return null
  return logItemTypeIdForEntry(entry, penName(entry))
}

/** A new grid row this sync would file. An interval or a non-log instant is false. */
export function newEntriesNeedPointers(prev: readonly TimeEntry[], next: readonly TimeEntry[]): boolean {
  if (prev === next) return false
  const seen = new Set(prev.map((entry) => entry.id))
  for (const entry of next) {
    if (seen.has(entry.id)) continue
    if (entryPointerWanted(entry)) return true
  }
  return false
}

/** A new count this sync would file. A tick on an existing count is false. */
export function newCountsNeedPointers(
  prev: readonly { id: string; name: string }[],
  next: readonly { id: string; name: string }[],
  showerRemoved: boolean,
): boolean {
  if (prev === next) return false
  const seen = new Set(prev.map((count) => count.id))
  for (const count of next) {
    if (seen.has(count.id)) continue
    if (!count.name.trim()) continue
    if (showerRemoved && count.id === SHOWER_COUNT_ID) continue
    return true
  }
  return false
}

/** File one new tracking row onto Thought Process or Log. A deleted copy stays gone. */
export function mirrorTrackingEntry(entryId: string, role: "thought-process" | "log"): void {
  const entry = useTimeTrackingStore.getState().entries.find((row) => row.id === entryId)
  if (!entry || !(entry.title ?? "").trim()) return
  const { thoughtListId, logListId } = ensureTrackingLists()
  const id = trackingItemId(entry.id)
  const store = useTaskStore.getState()
  if ((store.removedTaskIds ?? []).includes(id)) return
  if (store.tasks.some((task) => task.id === id)) return
  const listId = role === "thought-process" ? thoughtListId : logListId
  store.addTask(itemFromEntry(entry, role, listId))
}

/** Drop the list item for a tracking row that was replaced (a START closed by END). */
export function dropMirroredTrackingEntry(entryId: string): void {
  const id = trackingItemId(entryId)
  const store = useTaskStore.getState()
  if (store.tasks.some((task) => task.id === id)) store.deleteTask(id)
}

/**
 * Add pointers for log rows and counts that are not items yet. An existing
 * item keeps its type and lists. A painted interval is not an item.
 */
export function syncTrackingLists(): number {
  const { thoughtListId, logListId } = ensureTrackingLists()
  const state = useTaskStore.getState()
  const removed = new Set(state.removedTaskIds ?? [])
  const have = new Set(state.tasks.map((task) => task.id))
  const add: Task[] = []
  for (const entry of useTimeTrackingStore.getState().entries) {
    const typeId = entryPointerWanted(entry)
    if (!typeId) continue
    const id = trackingItemId(entry.id)
    if (have.has(id) || removed.has(id)) continue
    if (typeId === THOUGHT_PROCESS_TYPE_ID || typeId === LOG_TYPE_ID) {
      const role = typeId === THOUGHT_PROCESS_TYPE_ID ? "thought-process" : "log"
      add.push(itemFromEntry(entry, role, role === "thought-process" ? thoughtListId : logListId))
    } else {
      add.push(itemFromSubtype(entry, typeId))
    }
    have.add(id)
  }
  const showerRemoved = useCountStatusesStore.getState().builtins.shower === "removed"
  for (const count of useCountStatusesStore.getState().counts) {
    if (!count.name.trim()) continue
    if (showerRemoved && count.id === SHOWER_COUNT_ID) continue
    const id = countItemId(count.id)
    if (have.has(id) || removed.has(id)) continue
    add.push(itemFromCount(count))
    have.add(id)
  }
  if (add.length > 0) useTaskStore.getState().setTasks([...useTaskStore.getState().tasks, ...add])
  return add.length
}
