/**
 * lib/house-cleaning-items.ts — Tidy records on Items (Wave 10)
 *
 * Chores, needed rows, and area lists are ordinary Items/Lists (same stable ids
 * as Module Lists import). TidyView writes through here first. For one release,
 * `module.config.houseCleaning` is still dual-written as a read shim so an
 * unmigrated vault or a session that has not opened Lists yet still loads.
 *
 * Session chrome (timer, filters, theme, stuck/plan/sidequest runs) stays on
 * config — that is prefs/behavior, not the record tree.
 */
import type { List, Task } from "@/lib/types"
import type { ModuleInstance } from "@/lib/modules-store"
import {
  GENERAL_AREA,
  GENERAL_AREA_ID,
  normalizeHouseCleaning,
  seedHouseCleaning,
  type HouseArea,
  type HouseCleaningState,
  type HouseNeeded,
  type HouseTask,
  type Importance,
} from "@/lib/house-cleaning"
import {
  MODULE_SOURCE_ID_ATTR,
  MODULE_SOURCE_TIDY,
  TIDY_IMPORTANCE_LABEL,
  moduleImportAreaListId,
  moduleImportNeededItemId,
  moduleImportRootListId,
  moduleImportTidyItemId,
  sourceOf,
} from "@/lib/module-list-import-shared"
import { syncModuleListContents } from "@/lib/module-list-import"
import { syncModuleListFolders, taskStoreModuleListsMutators } from "@/lib/module-lists"

const LABEL_TO_IMPORTANCE: Record<string, Importance> = {
  Crucial: "crucial",
  Important: "important",
  Preferred: "preferred",
  Optional: "optional",
  Unclassified: "unset",
}

const RANK_TO_IMPORTANCE: Record<number, Importance> = {
  5: "crucial",
  4: "important",
  3: "preferred",
  2: "optional",
  1: "unset",
}

function tidySourceId(item: Pick<Task, "attributes">): string | undefined {
  const v = item.attributes?.[MODULE_SOURCE_ID_ATTR]
  return typeof v === "string" && v ? v : undefined
}

function importanceOf(item: Task): Importance {
  const label = item.attributes?.tidyImportance
  if (typeof label === "string" && LABEL_TO_IMPORTANCE[label]) return LABEL_TO_IMPORTANCE[label]
  if (typeof item.importance === "number" && RANK_TO_IMPORTANCE[item.importance]) {
    return RANK_TO_IMPORTANCE[item.importance]
  }
  return "unset"
}

function actualSecOf(item: Task): number {
  const raw = item.attributes?.actualSec
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return Math.round(raw)
  if (typeof item.actualDuration === "number" && item.actualDuration > 0) {
    return Math.round(item.actualDuration * 60)
  }
  return 0
}

function areaIdFromListId(moduleId: string, listId: string): string | null {
  const prefix = `mll-${moduleId}-tidy-a-`
  if (!listId.startsWith(prefix)) return null
  return listId.slice(prefix.length) || null
}

function choreSourceId(moduleId: string, itemId: string): string | null {
  const prefix = `mli-${moduleId}-tidy-`
  const neededPrefix = `mli-${moduleId}-tidy-n-`
  if (itemId.startsWith(neededPrefix)) return null
  if (!itemId.startsWith(prefix)) return null
  return itemId.slice(prefix.length) || null
}

function neededSourceId(moduleId: string, itemId: string): string | null {
  const prefix = `mli-${moduleId}-tidy-n-`
  if (!itemId.startsWith(prefix)) return null
  return itemId.slice(prefix.length) || null
}

/** True when this module already has Tidy chore/needed Items in the vault. */
export function hasTidyRecordItems(moduleId: string, tasks: readonly Task[]): boolean {
  const prefix = `mli-${moduleId}-tidy-`
  return tasks.some((t) => t.id.startsWith(prefix) && sourceOf(t) === MODULE_SOURCE_TIDY)
}

/**
 * Rebuild areas / chores / needed from Items. Returns null when no Tidy Items
 * exist yet (caller should use `module.config.houseCleaning`).
 */
export function houseRecordsFromItems(
  moduleId: string,
  tasks: readonly Task[],
  lists: readonly List[],
): Pick<HouseCleaningState, "areas" | "tasks" | "needed"> | null {
  if (!hasTidyRecordItems(moduleId, tasks)) return null

  const rootId = moduleImportRootListId(moduleId, MODULE_SOURCE_TIDY)
  const areas: HouseArea[] = lists
    .filter((l) => l.parentListId === rootId && areaIdFromListId(moduleId, l.id))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((l) => {
      const id = areaIdFromListId(moduleId, l.id)!
      return { id, name: l.name }
    })
    .filter((a) => a.id !== GENERAL_AREA_ID)

  const tidyItems = tasks.filter((t) => sourceOf(t) === MODULE_SOURCE_TIDY && t.id.startsWith(`mli-${moduleId}-tidy-`))

  const houseTasks: HouseTask[] = []
  const needed: HouseNeeded[] = []

  for (const item of tidyItems) {
    const asNeeded = neededSourceId(moduleId, item.id)
    if (asNeeded) {
      const areaAttr = item.attributes?.tidyArea
      needed.push({
        id: asNeeded,
        areaId: typeof areaAttr === "string" && areaAttr ? areaAttr : GENERAL_AREA_ID,
        text: String(item.title || item.description || ""),
        got: !!item.completed,
        createdAt: item.createdAt instanceof Date ? item.createdAt.getTime() : Date.now(),
      })
      continue
    }

    const choreId = choreSourceId(moduleId, item.id) ?? tidySourceId(item)
    if (!choreId) continue
    const areaAttr = item.attributes?.tidyArea
    let areaId = typeof areaAttr === "string" && areaAttr ? areaAttr : GENERAL_AREA_ID
    const listId = (item.lists ?? []).find((id) => areaIdFromListId(moduleId, id))
    if (listId) {
      const fromList = areaIdFromListId(moduleId, listId)
      if (fromList) areaId = fromList
    }
    let parentId: string | null = null
    if (item.parentTaskId) {
      parentId = choreSourceId(moduleId, item.parentTaskId)
    }
    houseTasks.push({
      id: choreId,
      areaId,
      parentId,
      title: String(item.title || item.description || ""),
      importance: importanceOf(item),
      estMin: typeof item.estimatedDuration === "number" ? item.estimatedDuration : 0,
      actualSec: actualSecOf(item),
      done: !!item.completed,
      completedAt: item.completed && item.completedDate
        ? item.completedDate instanceof Date
          ? item.completedDate.getTime()
          : new Date(item.completedDate).getTime()
        : null,
      collapsed: false,
      createdAt: item.createdAt instanceof Date ? item.createdAt.getTime() : Date.now(),
    })
  }

  return {
    areas: areas.length ? areas : [],
    tasks: houseTasks,
    needed,
  }
}

/**
 * Resolve Tidy state: record tree from Items when present, else config shim.
 * Session fields (timer, filters, stuck, plan, …) always come from config.
 */
export function resolveHouseCleaning(
  module: ModuleInstance,
  tasks: readonly Task[],
  lists: readonly List[],
): HouseCleaningState {
  const fromConfig = module.config?.houseCleaning
    ? normalizeHouseCleaning(module.config.houseCleaning)
    : seedHouseCleaning()
  const records = houseRecordsFromItems(module.id, tasks, lists)
  if (!records) return fromConfig
  return {
    ...fromConfig,
    areas: records.areas.length ? records.areas : fromConfig.areas,
    tasks: records.tasks,
    needed: records.needed,
  }
}

/**
 * Write Tidy chores / needed / area lists onto Items (and Module Lists folders).
 * Callers that still dual-write `module.config.houseCleaning` for one release
 * should do that separately — this is the authoritative record write.
 */
export function persistHouseCleaningItems(module: ModuleInstance, house: HouseCleaningState): void {
  const nextModule: ModuleInstance = {
    ...module,
    config: { ...module.config, houseCleaning: house },
  }
  const mut = taskStoreModuleListsMutators()
  syncModuleListFolders(mut, [nextModule])
  syncModuleListContents(mut, [nextModule])
}

/** Stable Item id helpers re-exported for tests / call sites. */
export {
  moduleImportTidyItemId,
  moduleImportNeededItemId,
  moduleImportAreaListId,
  TIDY_IMPORTANCE_LABEL,
  GENERAL_AREA,
}
