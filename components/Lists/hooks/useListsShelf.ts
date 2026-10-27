/**
 * components/Lists/hooks/useListsShelf.ts
 *
 * Task index, list and folder getters, and the grid entries for the open
 * folder. The previous index stays on a ref so a title edit can reuse it.
 * The orchestrator passes store values in. This hook does not subscribe.
 */
import { useCallback, useMemo, useRef } from "react"
import {
  capitalizeLabel,
  getItemLabel,
} from "@/lib/item-utils"
import {
  isNaArchiveCategoryId,
  isNaPeriodSmartCategoryId,
  isPeriodLedgerListId,
  tasksForPeriodLedgerList,
  tasksForNaSmartList,
  isScheduledFolderId,
  getTasksForScheduledFolder,
} from "@/lib/scheduled-lists-sync"
import { tasksForArchiveList } from "@/lib/archive-lists"
import { buildGridEntries } from "@/lib/lists-grid-entries"
import {
  buildListsTaskIndex,
  completionRateForList,
  smartTasksFor,
  tasksForList,
  type ListsTaskIndex,
} from "@/lib/lists-task-index"
import {
  ITEM_TYPES_LOCATION,
  compareItemTypeLists,
  itemTypeListLabel,
  tasksOfItemType,
} from "@/lib/item-type-lists"
import type { Folder, ItemTypeDefinition, List, Task } from "@/lib/types"
import type { SmartId } from "@/components/Lists/types"

export function useListsShelf({
  allTasks,
  categories,
  folders,
  itemTypes,
  location,
  isHome,
  isAll,
  currentFolder,
  homePinned,
  showSmartLists,
  showPeriodLedgerListsInAll,
  objectiveCount,
}: {
  allTasks: Task[]
  categories: List[]
  folders: Folder[]
  itemTypes: ItemTypeDefinition[]
  location: string
  isHome: boolean
  isAll: boolean
  currentFolder: Folder | null
  homePinned: string[]
  showSmartLists: boolean
  showPeriodLedgerListsInAll: boolean
  objectiveCount: number
}) {
  const taskIndexPrevRef = useRef<ListsTaskIndex | null>(null)
  const taskIndex = useMemo(() => {
    const next = buildListsTaskIndex(allTasks, taskIndexPrevRef.current)
    taskIndexPrevRef.current = next
    return next
  }, [allTasks])

  const categoryById = useMemo(() => {
    const map = new Map<string, List>()
    for (const category of categories) map.set(category.id, category)
    return map
  }, [categories])

  const getSmartTasks = useCallback(
    (id: SmartId) => smartTasksFor(taskIndex, id),
    [taskIndex],
  )

  const getTasksForCategory = useCallback(
    (categoryId: string) => {
      if (isNaArchiveCategoryId(categoryId, categories)) {
        const kind = categories.find((c) => c.id === categoryId)?.autoArchive
        return tasksForArchiveList(allTasks, categoryId, kind)
      }
      if (isNaPeriodSmartCategoryId(categoryId)) return tasksForNaSmartList(categoryId, allTasks)
      if (isPeriodLedgerListId(categoryId)) return tasksForPeriodLedgerList(categoryId, allTasks, folders)
      return tasksForList(taskIndex, categoryId)
    },
    [taskIndex, allTasks, categories, folders],
  )

  const countForFolder = useCallback(
    (f: Folder) => {
      if (isScheduledFolderId(f.id)) {
        const children = folders.filter((x) => x.parentFolderId === f.id)
        if (children.length > 0) return children.length
        return getTasksForScheduledFolder(allTasks, f.id).length
      }
      return f.listIds.length || folders.filter((x) => x.parentFolderId === f.id).length
    },
    [allTasks, folders],
  )

  const getCategoryCompletionRate = useCallback(
    (categoryId: string) => completionRateForList(taskIndex, categoryId),
    [taskIndex],
  )

  const itemLabelFor = useCallback(
    (categoryId?: string, category?: List | null) =>
      capitalizeLabel(getItemLabel(category ?? undefined, folders, categoryId)),
    [folders],
  )

  const isItemTypes = location === ITEM_TYPES_LOCATION
  const entries = useMemo(
    () =>
      isItemTypes
        ? [...itemTypes].sort(compareItemTypeLists).map((type) => ({
            kind: "item-type" as const,
            id: String(type.id),
            name: itemTypeListLabel(type),
            color: type.color,
            icon: type.icon,
            count: tasksOfItemType(String(type.id), allTasks, itemTypes).length,
          }))
        : buildGridEntries({
        isHome,
        isAll,
        currentFolder,
        folders,
        categories,
        homePinned,
        showSmartLists,
        showPeriodLedgerListsInAll,
        allTasks,
        getSmartTasks,
        getTasksForCategory,
        countForFolder,
        objectiveCount,
      }),
    [
      isItemTypes,
      itemTypes,
      isHome,
      isAll,
      currentFolder,
      folders,
      categories,
      homePinned,
      showSmartLists,
      showPeriodLedgerListsInAll,
      allTasks,
      getSmartTasks,
      getTasksForCategory,
      countForFolder,
      objectiveCount,
    ],
  )

  return {
    categoryById,
    getSmartTasks,
    getTasksForCategory,
    countForFolder,
    getCategoryCompletionRate,
    itemLabelFor,
    isItemTypes,
    entries,
  }
}
