/**
 * lib/module-list-import-shared.ts — Ids, field helpers, and merge for Module Lists import
 *
 * Kept free of per-module planners so Tidy / Trip can import it without a cycle.
 */
import type { AttributeDefinition, AttributeValue, List, Task } from "@/lib/types"
import { withCompleted } from "@/lib/completion-status"

export const MODULE_SOURCE_ATTR = "moduleSource"
export const MODULE_SOURCE_ID_ATTR = "moduleSourceId"
export const MODULE_INSTANCE_ATTR = "moduleInstanceId"

export const MODULE_SOURCE_TIDY = "house-cleaning"
export const MODULE_SOURCE_TRIP = "trip-itinerary"

export type ModuleImportSource = typeof MODULE_SOURCE_TIDY | typeof MODULE_SOURCE_TRIP

export interface ModuleImportPlan {
  lists: List[]
  items: Task[]
}

export interface ListRollup {
  open: number
  done: number
  estMin: number
}

export interface SubtaskProgress {
  done: number
  total: number
}

export function moduleImportRootListId(moduleId: string, source: ModuleImportSource): string {
  return `mll-${moduleId}-${source === MODULE_SOURCE_TIDY ? "tidy" : "trip"}`
}

export function moduleImportAreaListId(moduleId: string, areaId: string): string {
  return `mll-${moduleId}-tidy-a-${areaId}`
}

export function moduleImportNeededListId(moduleId: string): string {
  return `mll-${moduleId}-tidy-needed`
}

export function moduleImportTidyItemId(moduleId: string, taskId: string): string {
  return `mli-${moduleId}-tidy-${taskId}`
}

export function moduleImportNeededItemId(moduleId: string, neededId: string): string {
  return `mli-${moduleId}-tidy-n-${neededId}`
}

export function moduleImportTripDayListId(moduleId: string, date: string): string {
  return `mll-${moduleId}-trip-d-${date}`
}

export function moduleImportTripEntryId(moduleId: string, entryId: string): string {
  return `mli-${moduleId}-trip-${entryId}`
}

export function isModuleImportItemId(id: string, moduleId: string): boolean {
  return id.startsWith(`mli-${moduleId}-`)
}

export function isModuleImportListId(id: string, moduleId: string): boolean {
  return id.startsWith(`mll-${moduleId}-`)
}

export function isModuleImportListIdAny(id: string): boolean {
  return id.startsWith("mll-")
}

/** Tidy Crucial → Lists importance 5 (higher matters more). */
export const TIDY_IMPORTANCE_RANK = {
  crucial: 5,
  important: 4,
  preferred: 3,
  optional: 2,
  unset: 1,
} as const

export const TIDY_IMPORTANCE_LABEL = {
  crucial: "Crucial",
  important: "Important",
  preferred: "Preferred",
  optional: "Optional",
  unset: "Unclassified",
} as const

/** Seconds → minutes, keeping fractional minutes so Actual 3:51 survives. */
export function actualMinutesFromSec(actualSec: number): number | undefined {
  if (!Number.isFinite(actualSec) || actualSec <= 0) return undefined
  return actualSec / 60
}

export function tidyChoreAttributes(): AttributeDefinition[] {
  return [
    {
      id: "tidyImportance",
      name: "Priority",
      type: "selection",
      optionSource: "manual",
      options: ["Crucial", "Important", "Preferred", "Optional", "Unclassified"],
    },
    { id: "estMin", name: "Est", type: "number", unit: "min" },
    { id: "actualSec", name: "Actual", type: "number", unit: "s", allowFloat: false },
  ]
}

export function stampSource(
  attributes: Record<string, AttributeValue> | undefined,
  source: ModuleImportSource,
  sourceId: string,
  moduleId: string,
): Record<string, AttributeValue> {
  return {
    ...(attributes || {}),
    [MODULE_SOURCE_ATTR]: source,
    [MODULE_SOURCE_ID_ATTR]: sourceId,
    [MODULE_INSTANCE_ATTR]: moduleId,
  }
}

export function sourceOf(item: Pick<Task, "attributes">): string | undefined {
  const v = item.attributes?.[MODULE_SOURCE_ATTR]
  return typeof v === "string" ? v : undefined
}

export function withImportCompletion<T extends Pick<Task, "status" | "completed">>(
  item: T,
  completed: boolean,
): T {
  return withCompleted(item, completed)
}

/**
 * Overlay mapped fields onto an existing item without dropping user extras
 * (notes, body, extra tags, extra list membership, extra attributes, links).
 */
export function mergeImportedItem(existing: Task, mapped: Task): Task {
  const mappedListIds = new Set(mapped.lists ?? [])
  const extraLists = (existing.lists ?? []).filter((id) => !isModuleImportListIdAny(id) && !mappedListIds.has(id))
  const mappedTags = new Set((mapped.tags ?? []).map((t) => t.toLowerCase()))
  const extraTags = (existing.tags ?? []).filter((t) => !mappedTags.has(t.toLowerCase()))
  return {
    ...existing,
    ...mapped,
    notes: existing.notes,
    body: existing.body,
    links: existing.links,
    why: existing.why,
    consequences: existing.consequences,
    deadline: existing.deadline,
    scheduledDate: mapped.scheduledDate ?? existing.scheduledDate,
    scheduledTime: mapped.scheduledTime ?? existing.scheduledTime,
    tags: [...(mapped.tags ?? []), ...extraTags],
    lists: [...(mapped.lists ?? []), ...extraLists],
    attributes: { ...(existing.attributes || {}), ...(mapped.attributes || {}) },
    itemAttributeDefinitions: existing.itemAttributeDefinitions,
  }
}

function timeOf(value: Date | string | number | undefined): number | undefined {
  if (value == null) return undefined
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(t) ? t : undefined
}

function sameAttrMap(
  a: Record<string, AttributeValue> | undefined,
  b: Record<string, AttributeValue> | undefined,
): boolean {
  return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {})
}

function sameStringArr(a: string[] | undefined, b: string[] | undefined): boolean {
  const left = a ?? []
  const right = b ?? []
  if (left.length !== right.length) return false
  return left.every((v, i) => v === right[i])
}

/** True when a write would not change anything Lists already stores. */
export function importedItemUnchanged(existing: Task, next: Task): boolean {
  return (
    existing.title === next.title &&
    existing.description === next.description &&
    existing.completed === next.completed &&
    existing.status === next.status &&
    existing.estimatedDuration === next.estimatedDuration &&
    existing.actualDuration === next.actualDuration &&
    existing.importance === next.importance &&
    existing.parentTaskId === next.parentTaskId &&
    existing.stage === next.stage &&
    existing.type === next.type &&
    timeOf(existing.completedDate) === timeOf(next.completedDate) &&
    timeOf(existing.createdAt) === timeOf(next.createdAt) &&
    existing.scheduledTime === next.scheduledTime &&
    timeOf(existing.scheduledDate) === timeOf(next.scheduledDate) &&
    sameStringArr(existing.lists, next.lists) &&
    sameStringArr(existing.tags, next.tags) &&
    sameAttrMap(existing.attributes, next.attributes) &&
    (existing.notes ?? "") === (next.notes ?? "") &&
    (existing.body ?? "") === (next.body ?? "")
  )
}

function listSignature(list: List): string {
  return JSON.stringify({
    name: list.name,
    parentListId: list.parentListId ?? null,
    order: list.order ?? 0,
    description: list.description ?? "",
    itemLabel: list.itemLabel ?? "",
    itemTypeId: list.itemTypeId ?? "",
    displayedAttributes: list.displayedAttributes ?? [],
    detailsColumns: list.detailsColumns ?? [],
    enabledDisplays: list.enabledDisplays ?? [],
    itemAttributes: (list.itemAttributes ?? []).map((a) => a.id),
    createdByModuleId: list.createdByModuleId ?? "",
    scheduleable: list.scheduleable !== false,
  })
}

export function importedListUnchanged(existing: List, next: List): boolean {
  return listSignature(existing) === listSignature(next)
}

/** Leaf items only (no imported children) — matches Tidy section rollups. */
export function rollupFromItems(items: Task[]): ListRollup {
  const childOf = new Set(items.map((t) => t.parentTaskId).filter(Boolean) as string[])
  const leaves = items.filter((t) => !childOf.has(t.id))
  let open = 0
  let done = 0
  let estMin = 0
  for (const item of leaves) {
    if (item.completed) done += 1
    else {
      open += 1
      estMin += item.estimatedDuration || 0
    }
  }
  return { open, done, estMin }
}

export function subtaskProgress(items: Task[], parentId: string): SubtaskProgress {
  const kids = items.filter((t) => t.parentTaskId === parentId)
  return {
    done: kids.filter((t) => t.completed).length,
    total: kids.length,
  }
}
