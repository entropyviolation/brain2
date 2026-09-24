/**
 * lib/module-list-import-tidy.ts — Tidy house-cleaning → Module Lists items
 *
 * Areas become nested lists under a Whole house parent list. Each chore becomes
 * a full item (title, priority, estimate, actual, completed, parentTaskId).
 * Done items are imported. Duplicate titles stay separate rows. Rollups are
 * computed from children (`rollupFromItems`), never stored as a stale string.
 */
import type { List, Task } from "@/lib/types"
import type { ModuleInstance } from "@/lib/modules-store"
import type { HouseArea, HouseCleaningState, HouseNeeded, HouseTask, Importance } from "@/lib/house-cleaning"
import { GENERAL_AREA, allAreas, importanceLabel } from "@/lib/house-cleaning"
import {
  MODULE_SOURCE_TIDY,
  TIDY_IMPORTANCE_LABEL,
  TIDY_IMPORTANCE_RANK,
  actualMinutesFromSec,
  moduleImportAreaListId,
  moduleImportNeededItemId,
  moduleImportNeededListId,
  moduleImportRootListId,
  moduleImportTidyItemId,
  stampSource,
  tidyChoreAttributes,
  withImportCompletion,
  type ModuleImportPlan,
} from "@/lib/module-list-import-shared"

const TIDY_COLOR = "#d97706"
const NEEDED_COLOR = "#0d9488"

function importanceRank(k: Importance): number {
  return TIDY_IMPORTANCE_RANK[k] ?? TIDY_IMPORTANCE_RANK.unset
}

function importanceName(k: Importance): string {
  return TIDY_IMPORTANCE_LABEL[k] ?? importanceLabel(k)
}

function areaList(moduleId: string, area: HouseArea, parentListId: string, order: number): List {
  return {
    id: moduleImportAreaListId(moduleId, area.id),
    name: area.name,
    color: TIDY_COLOR,
    createdAt: new Date(0),
    parentListId,
    order,
    createdByModuleId: moduleId,
    scheduleable: false,
    itemTypeId: "item",
    itemLabel: "chore",
    description: `${area.name} chores from Tidy. Open, estimates, and done counts come from the items.`,
    itemAttributes: tidyChoreAttributes(),
    displayedAttributes: ["tidyImportance", "estMin"],
    enabledDisplays: ["default", "checklist", "table", "spreadsheet"],
  }
}

function wholeHouseList(module: ModuleInstance, areas: HouseArea[]): List {
  const names = areas.map((a) => a.name).join(", ")
  return {
    id: moduleImportRootListId(module.id, MODULE_SOURCE_TIDY),
    name: "Whole house",
    color: TIDY_COLOR,
    createdAt: new Date(0),
    createdByModuleId: module.id,
    scheduleable: false,
    itemTypeId: "item",
    itemLabel: "area",
    description: `Tidy areas as nested lists (${names}). Open Kitchen, Living Room, … — not a flat dump.`,
    enabledDisplays: ["default", "checklist", "table"],
    order: 0,
  }
}

function neededList(moduleId: string): List {
  return {
    id: moduleImportNeededListId(moduleId),
    name: "Needed",
    color: NEEDED_COLOR,
    createdAt: new Date(0),
    createdByModuleId: moduleId,
    scheduleable: false,
    itemTypeId: "item",
    itemLabel: "supply",
    description: "Supplies Tidy marked as needed. Checking off here is a Lists view of `needed.got`.",
    enabledDisplays: ["default", "checklist", "table"],
    order: 100,
  }
}

function choreItem(moduleId: string, task: HouseTask, listId: string): Task {
  const title = String(task.title ?? "")
  const importance = importanceRank(task.importance)
  const estMin = task.estMin > 0 ? task.estMin : undefined
  const actualMin = actualMinutesFromSec(task.actualSec)
  const parentTaskId = task.parentId ? moduleImportTidyItemId(moduleId, task.parentId) : undefined
  const attributes = stampSource(
    {
      tidyImportance: importanceName(task.importance),
      ...(estMin != null ? { estMin } : {}),
      ...(task.actualSec > 0 ? { actualSec: Math.round(task.actualSec) } : {}),
      tidyArea: task.areaId,
    },
    MODULE_SOURCE_TIDY,
    task.id,
    moduleId,
  )
  const base: Task = {
    id: moduleImportTidyItemId(moduleId, task.id),
    description: title,
    title,
    type: "item",
    stage: task.done ? "completed" : "list",
    createdAt: new Date(task.createdAt || 0),
    completed: !!task.done,
    lists: [listId],
    tags: ["tidy", task.areaId].filter(Boolean),
    attributes,
    importance,
    estimatedDuration: estMin,
    actualDuration: actualMin,
    parentTaskId,
    completedDate: task.done && task.completedAt ? new Date(task.completedAt) : undefined,
  }
  return withImportCompletion(base, !!task.done)
}

function neededItem(moduleId: string, row: HouseNeeded, listId: string): Task {
  const title = String(row.text ?? "")
  const base: Task = {
    id: moduleImportNeededItemId(moduleId, row.id),
    description: title,
    title,
    type: "item",
    stage: row.got ? "completed" : "list",
    createdAt: new Date(row.createdAt || 0),
    completed: !!row.got,
    lists: [listId],
    tags: ["tidy", "needed", row.areaId].filter(Boolean),
    attributes: stampSource({ tidyArea: row.areaId }, MODULE_SOURCE_TIDY, row.id, moduleId),
  }
  return withImportCompletion(base, !!row.got)
}

export function planTidyModuleLists(module: ModuleInstance, house: HouseCleaningState): ModuleImportPlan {
  const moduleId = module.id
  const areas = allAreas(house)
  const lists: List[] = [wholeHouseList(module, areas)]
  areas.forEach((area, i) => {
    lists.push(areaList(moduleId, area, lists[0].id, i + 1))
  })
  lists.push(neededList(moduleId))

  const items: Task[] = []
  for (const task of house.tasks) {
    const areaId = task.areaId || GENERAL_AREA.id
    const listId = moduleImportAreaListId(moduleId, areaId)
    items.push(choreItem(moduleId, task, listId))
  }
  for (const row of house.needed) {
    items.push(neededItem(moduleId, row, moduleImportNeededListId(moduleId)))
  }

  return { lists, items }
}
