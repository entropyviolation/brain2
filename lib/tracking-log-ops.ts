/**
 * lib/tracking-log-ops.ts — Move or copy a tracking-log instant
 *
 * The logged clock is `date` + `startMin` (+ `clockCertainty`). A shelf
 * change rewrites the fields `classifyLogBookRow` reads and leaves that
 * clock alone. A copy is a new id with the same clock. Thought-process and
 * Log pointers follow the shelf; an id in `removedTaskIds` is not put back.
 */
import { runAsAction } from "@/lib/action-history"
import {
  ACTIVITY_SCOPE_ID,
  INTAKE_PEN_NAME,
  OBJECTIVE_PEN_NAME,
  SPENT_PEN_NAME,
  SWITCH_PEN_NAME,
  TEXT_LOG_PEN_NAME,
  THOUGHT_PROCESS_KIND,
  classifyLogBookRow,
  type LogBookList,
} from "@/components/Home/Tracking/tracking-log-model"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { logItemTypeIdForEntry } from "@/lib/log-item-role"
import { SPEND_EVENT_KIND } from "@/lib/spend"
import { useKitchenStore } from "@/lib/kitchen-store"
import { useTaskStore } from "@/lib/task-store"
import { eventKindSlug, type TimeEntry } from "@/lib/time-entries"
import { appendTrackingInstants, stablePenColor, useTimeTrackingStore } from "@/lib/time-tracking-store"
import {
  LOG_LIST_ID,
  THOUGHT_PROCESS_LIST_ID,
  ensureTrackingLists,
  mirrorTrackingEntry,
  syncTrackingLists,
  trackingItemId,
} from "@/lib/tracking-lists"
import { LOG_TYPE_ID, THOUGHT_PROCESS_TYPE_ID, TRACKING_ITEM_ATTR } from "@/lib/tracking-item-types"

type ShelfPatch = Partial<Omit<TimeEntry, "id" | "date" | "startMin" | "endMin" | "clockCertainty">>

const RESERVED_EVENT_KINDS = new Set([
  THOUGHT_PROCESS_KIND,
  SPEND_EVENT_KIND,
  "switch",
  "switch-task",
  "switch-objective",
  "intake",
  "intake.food",
  "intake.drink",
  "intake.drug",
])

function findEntry(entryId: string): TimeEntry | undefined {
  return useTimeTrackingStore.getState().entries.find((row) => row.id === entryId)
}

function penNameOf(entry: Pick<TimeEntry, "scopeId" | "penId">): string {
  const scope = useTimeTrackingStore.getState().scopes.find((row) => row.id === entry.scopeId)
  return scope?.pens.find((pen) => pen.id === entry.penId)?.name ?? ""
}

function shelfOf(entry: TimeEntry): LogBookList | null {
  return classifyLogBookRow(entry, penNameOf(entry))?.list ?? null
}

function penIdNamed(scopeId: string, name: string): string {
  const store = useTimeTrackingStore.getState()
  const scope = store.scopes.find((row) => row.id === scopeId)
  if (!scope) return ""
  const existing = scope.pens.find((pen) => pen.name.toLowerCase() === name.toLowerCase())
  if (existing) return existing.id
  return store.addPen(scopeId, { name, color: stablePenColor(name) })
}

function clearIntake(): ShelfPatch {
  return { intakeClass: undefined }
}

function clearSpend(): ShelfPatch {
  return { spendAmount: undefined, spendOn: undefined, spendSource: undefined }
}

function clearSwitch(): ShelfPatch {
  return { switchFrom: undefined, switchTo: undefined }
}

function activityPen(name: string, patch: ShelfPatch): ShelfPatch | null {
  const penId = penIdNamed(ACTIVITY_SCOPE_ID, name)
  if (!penId) return null
  return { ...patch, scopeId: ACTIVITY_SCOPE_ID, penId }
}

function eventKindForTitle(title: string): string {
  const slug = eventKindSlug(title)
  if (!slug || RESERVED_EVENT_KINDS.has(slug) || slug.startsWith("intake.")) return "event"
  return slug
}

function shelfPatch(entry: TimeEntry, target: LogBookList): ShelfPatch | null {
  const title = (entry.title ?? "").trim()
  if (target === "food" || target === "drink" || target === "drug") {
    return activityPen(INTAKE_PEN_NAME, {
      eventKind: `intake.${target}`,
      intakeClass: target,
      ...clearSpend(),
      ...clearSwitch(),
    })
  }
  if (target === "intake") {
    return activityPen(INTAKE_PEN_NAME, {
      eventKind: "intake",
      ...clearIntake(),
      ...clearSpend(),
      ...clearSwitch(),
    })
  }
  if (target === "thought") {
    return activityPen(TEXT_LOG_PEN_NAME, {
      eventKind: THOUGHT_PROCESS_KIND,
      ...clearIntake(),
      ...clearSpend(),
      ...clearSwitch(),
    })
  }
  if (target === "note") {
    return activityPen(TEXT_LOG_PEN_NAME, {
      eventKind: "",
      ...clearIntake(),
      ...clearSpend(),
      ...clearSwitch(),
    })
  }
  if (target === "event") {
    return activityPen(TEXT_LOG_PEN_NAME, {
      eventKind: eventKindForTitle(title),
      ...clearIntake(),
      ...clearSpend(),
      ...clearSwitch(),
    })
  }
  if (target === "spend") {
    return activityPen(SPENT_PEN_NAME, {
      eventKind: SPEND_EVENT_KIND,
      ...clearIntake(),
      ...clearSwitch(),
    })
  }
  const pen = penNameOf(entry).trim().toLowerCase()
  const keepPen = entry.scopeId === ACTIVITY_SCOPE_ID && (pen === SWITCH_PEN_NAME.toLowerCase() || pen === OBJECTIVE_PEN_NAME.toLowerCase())
  const penId = keepPen ? entry.penId : entry.scopeId === ACTIVITY_SCOPE_ID ? penIdNamed(ACTIVITY_SCOPE_ID, SWITCH_PEN_NAME) : entry.penId
  if (!penId) return null
  const patch: ShelfPatch = {
    penId,
    eventKind: "",
    ...clearIntake(),
    ...clearSpend(),
  }
  if (entry.scopeId !== ACTIVITY_SCOPE_ID && !entry.switchTo?.trim()) {
    patch.switchTo = title || "switch"
  }
  return patch
}

function listsMatch(lists: string[] | undefined, typeId: string): boolean {
  if (typeId === THOUGHT_PROCESS_TYPE_ID) return lists?.length === 1 && lists[0] === THOUGHT_PROCESS_LIST_ID
  if (typeId === LOG_TYPE_ID) return lists?.length === 1 && lists[0] === LOG_LIST_ID
  return !lists?.length
}

/** Point the list item at the shelf this instant is on now. A tombstone stays gone. */
function filePointer(entryId: string): void {
  const entry = findEntry(entryId)
  if (!entry) return
  const itemId = trackingItemId(entryId)
  const store = useTaskStore.getState()
  if ((store.removedTaskIds ?? []).includes(itemId)) return
  const typeId = logItemTypeIdForEntry(entry, penNameOf(entry))
  if (!typeId) return
  const existing = store.tasks.find((task) => task.id === itemId)
  if (!existing && (typeId === THOUGHT_PROCESS_TYPE_ID || typeId === LOG_TYPE_ID)) {
    mirrorTrackingEntry(entryId, typeId === THOUGHT_PROCESS_TYPE_ID ? "thought-process" : "log")
    return
  }
  if (!existing) {
    syncTrackingLists()
    return
  }
  if (existing.type === typeId && listsMatch(existing.lists, typeId)) return
  const { thoughtListId, logListId } = ensureTrackingLists()
  const lists = typeId === THOUGHT_PROCESS_TYPE_ID ? [thoughtListId] : typeId === LOG_TYPE_ID ? [logListId] : []
  const title = (entry.title ?? "").trim() || itemTitleOrUntitled(existing)
  useTaskStore.getState().updateTask({
    ...existing,
    type: typeId,
    lists,
    title,
    description: title,
    attributes: {
      ...existing.attributes,
      [TRACKING_ITEM_ATTR.clock]: entry.clockCertainty ?? "exact",
      [TRACKING_ITEM_ATTR.eventKind]: entry.eventKind ?? "",
      [TRACKING_ITEM_ATTR.entryId]: entry.id,
    },
  })
}

function reassignInPlace(entryId: string, targetList: LogBookList): boolean {
  const entry = findEntry(entryId)
  if (!entry || entry.kind !== "instant") return false
  if (shelfOf(entry) === targetList) {
    filePointer(entryId)
    return true
  }
  const patch = shelfPatch(entry, targetList)
  if (!patch) return false
  useTimeTrackingStore.getState().updateEntry(entryId, patch)
  const next = findEntry(entryId)
  if (!next || shelfOf(next) !== targetList) return false
  filePointer(entryId)
  return true
}

function newEntryId(): string {
  return `te-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function cloneEntry(source: TimeEntry, id: string): TimeEntry {
  const copy = structuredClone(source)
  copy.id = id
  delete copy.spanId
  return copy
}

/**
 * Move an instant onto another log shelf.
 * Returns false when the entry is missing or is not an instant.
 * Does not write `date`, `startMin`, `endMin`, or `clockCertainty`.
 */
export function reassignLogBookList(entryId: string, targetList: LogBookList): boolean {
  const entry = findEntry(entryId)
  if (!entry || entry.kind !== "instant") return false
  if (shelfOf(entry) === targetList) return true
  return runAsAction("move log shelf", () => reassignInPlace(entryId, targetList))
}

/**
 * New instant id, same clock as the source. A different `targetList` is
 * applied only to the copy. A food plate is copied onto the new id and does
 * not draw stock again. The new list pointer is not the old item id.
 * Returns null when the source is missing.
 */
export function duplicateLogEntry(entryId: string, opts?: { targetList?: LogBookList }): string | null {
  const source = findEntry(entryId)
  if (!source) return null
  const sourceShelf = shelfOf(source)
  const nextId = newEntryId()
  const copy = cloneEntry(source, nextId)
  return runAsAction("duplicate log", () => {
    appendTrackingInstants([copy])
    const target = opts?.targetList
    if (target && target !== sourceShelf) reassignInPlace(nextId, target)
    else filePointer(nextId)
    if (sourceShelf === "food") useKitchenStore.getState().duplicatePlate(entryId, nextId)
    return nextId
  })
}
