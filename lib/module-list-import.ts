/**
 * lib/module-list-import.ts — Project workspace module records into Module Lists
 *
 * Tidy (and Trip Itinerary) still write a shadow tree on `module.config.*`.
 * This module is the citizenship seam: every useful field becomes a real List
 * item under `{ModuleName} Lists`, nested the way Lists already knows how to
 * open (area/day sublists, parentTaskId children). Re-import is idempotent —
 * stable ids, in-place updates, user notes/extra lists/tags kept.
 *
 * Tidy remains the write source for mapped fields until two-way sync lands.
 * See `components/Lists/MODULE_LISTS.md`.
 */
import type { List, Task } from "@/lib/types"
import type { ModuleInstance } from "@/lib/modules-store"
import {
  addModuleCreatedLists,
  isWorkspaceModule,
  type ModuleListsMutators,
} from "@/lib/module-lists"
import { normalizeHouseCleaning } from "@/lib/house-cleaning"
import { planTidyModuleLists } from "@/lib/module-list-import-tidy"
import { planTripModuleLists } from "@/lib/module-list-import-trip"
import {
  importedItemUnchanged,
  importedListUnchanged,
  isModuleImportItemId,
  isModuleImportListId,
  isModuleImportListIdAny,
  mergeImportedItem,
  type ModuleImportPlan,
} from "@/lib/module-list-import-shared"

export type { ModuleImportPlan, ListRollup, SubtaskProgress, ModuleImportSource } from "@/lib/module-list-import-shared"
export {
  MODULE_SOURCE_ATTR,
  MODULE_SOURCE_ID_ATTR,
  MODULE_INSTANCE_ATTR,
  MODULE_SOURCE_TIDY,
  MODULE_SOURCE_TRIP,
  TIDY_IMPORTANCE_RANK,
  TIDY_IMPORTANCE_LABEL,
  actualMinutesFromSec,
  importedItemUnchanged,
  importedListUnchanged,
  isModuleImportItemId,
  isModuleImportListId,
  mergeImportedItem,
  moduleImportAreaListId,
  moduleImportNeededItemId,
  moduleImportNeededListId,
  moduleImportRootListId,
  moduleImportTidyItemId,
  moduleImportTripDayListId,
  moduleImportTripEntryId,
  rollupFromItems,
  sourceOf,
  stampSource,
  subtaskProgress,
  tidyChoreAttributes,
  withImportCompletion,
} from "@/lib/module-list-import-shared"

export interface ModuleListImportMutators extends ModuleListsMutators {
  tasks: Task[]
  upsertImportedItem: (item: Task) => void
  deleteImportedItem: (id: string) => void
}

export function planModuleLists(module: ModuleInstance): ModuleImportPlan {
  const lists: List[] = []
  const items: Task[] = []
  if (!isWorkspaceModule(module)) return { lists, items }

  if (module.config?.houseCleaning) {
    const tidy = planTidyModuleLists(module, normalizeHouseCleaning(module.config.houseCleaning))
    lists.push(...tidy.lists)
    items.push(...tidy.items)
  }
  if (module.config?.tripItinerary) {
    const trip = planTripModuleLists(module, module.config.tripItinerary)
    lists.push(...trip.lists)
    items.push(...trip.items)
  }
  return { lists, items }
}

function applyListPlan(mut: ModuleListsMutators, module: ModuleInstance, lists: List[]): void {
  if (lists.length === 0) return
  for (const list of lists) {
    const existing = mut.lists.find((c) => c.id === list.id)
    if (!existing) continue
    if (importedListUnchanged(existing, list)) continue
    mut.updateList({
      ...existing,
      name: list.name,
      description: list.description,
      parentListId: list.parentListId,
      order: list.order,
      itemLabel: list.itemLabel,
      itemTypeId: list.itemTypeId,
      itemAttributes: list.itemAttributes,
      displayedAttributes: list.displayedAttributes,
      enabledDisplays: list.enabledDisplays,
      scheduleable: list.scheduleable,
      createdByModuleId: list.createdByModuleId ?? existing.createdByModuleId,
      color: existing.color || list.color,
    })
  }
  addModuleCreatedLists(mut, module, lists)
}

function applyItemPlan(mut: ModuleListImportMutators, moduleId: string, items: Task[]): void {
  const wanted = new Set(items.map((t) => t.id))
  for (const mapped of items) {
    const existing = mut.tasks.find((t) => t.id === mapped.id)
    const next = existing ? mergeImportedItem(existing, mapped) : mapped
    if (existing && importedItemUnchanged(existing, next)) continue
    mut.upsertImportedItem(next)
  }
  for (const task of [...mut.tasks]) {
    if (!isModuleImportItemId(task.id, moduleId)) continue
    if (wanted.has(task.id)) continue
    const extraLists = (task.lists ?? []).filter((id) => !isModuleImportListIdAny(id))
    if (extraLists.length > 0) {
      const detached: Task = { ...task, lists: extraLists }
      if (!importedItemUnchanged(task, detached)) mut.upsertImportedItem(detached)
      continue
    }
    mut.deleteImportedItem(task.id)
  }
}

function pruneOrphanImportLists(mut: ModuleListImportMutators, moduleId: string, keep: Set<string>): void {
  const orphans = mut.lists.filter((c) => isModuleImportListId(c.id, moduleId) && !keep.has(c.id))
  for (const list of orphans) {
    const usedByUserItem = mut.tasks.some(
      (t) => (t.lists ?? []).includes(list.id) && !isModuleImportItemId(t.id, moduleId),
    )
    if (usedByUserItem) continue
    for (const folder of mut.folders) {
      if (folder.listIds.includes(list.id)) mut.removeListFromFolder(folder.id, list.id)
    }
  }
}

/**
 * File + upsert Module Lists contents for every workspace that owns a shadow
 * tree. Idempotent. No-op when `mut` cannot write items.
 */
export function syncModuleListContents(mut: ModuleListsMutators, modules: ModuleInstance[]): void {
  const itemMut = mut as ModuleListImportMutators
  if (typeof itemMut.upsertImportedItem !== "function" || typeof itemMut.deleteImportedItem !== "function") return
  if (!Array.isArray(itemMut.tasks)) return
  const workspaces = modules.filter(isWorkspaceModule)
  for (const module of workspaces) {
    const plan = planModuleLists(module)
    if (plan.lists.length === 0 && plan.items.length === 0) continue
    applyListPlan(mut, module, plan.lists)
    applyItemPlan(itemMut, module.id, plan.items)
    pruneOrphanImportLists(itemMut, module.id, new Set(plan.lists.map((l) => l.id)))
  }
}
