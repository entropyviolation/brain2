/**
 * components/Lists/hooks/useOpenListItems.ts
 *
 * One pipeline for the open list: membership, type filter, caption search,
 * and Default sort. Search resets when the open target changes. Sort persists
 * on the list record, or for this session when the target has no List record.
 * The orchestrator passes chrome and store values in. This hook does not subscribe.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import type { ListDisplay } from "@/lib/lists-ui-store"
import { isClearedFromWork } from "@/lib/completion-status"
import { visibleListItems } from "@/lib/list-sent"
import {
  getTasksForFolderAllView,
  isTaskUncategorizedInFolder,
  isTaskUncategorizedGlobally,
  filterTasksByHiddenFolderLists,
  filterTasksByHiddenGlobalFolders,
} from "@/lib/folder-all-items"
import { ROOT_ALL_FOLDER_ID } from "@/lib/lists-grid-entries"
import { isScheduledFolderId, getTasksForScheduledFolder } from "@/lib/scheduled-lists-sync"
import {
  filterTasksHiddenFromGlobalAll,
} from "@/lib/module-lists"
import {
  filterTasksByHiddenItemTypes,
  shouldShowTypeFilter,
  typeFilterItems,
  typesPresentInTasks,
} from "@/lib/list-type-filter"
import { listAllowedTypeIds } from "@/lib/list-item-types"
import { tasksOfItemType } from "@/lib/item-type-lists"
import { getItemType } from "@/lib/item-types"
import type { AttributeDefinition, Folder, ItemTypeDefinition, List, ListItemSort, Task } from "@/lib/types"
import { resolveDefaultViewSort, setDefaultViewSort } from "@/lib/default-view-prefs"
import { filterListItemsBySearch, listItemSortOptions, sortListItems } from "@/lib/list-item-sort"
import { listAttributeSchema, mergeListAttributes } from "@/components/Lists/attribute-editor"
import { openTargetKey } from "@/components/Lists/open-target"
import type { OpenTarget, SmartId } from "@/components/Lists/types"
import { withoutStepItems } from "@/lib/step-item-guard"

export function useOpenListItems({
  openTarget,
  openCategory,
  viewList,
  currentDisplay,
  allTasks,
  categories,
  folders,
  currentFolder,
  itemTypes,
  getSmartTasks,
  getTasksForCategory,
  updateList,
  hiddenItemTypeIdsByTarget,
  folderAllUncategorizedOnly,
  folderAllHideUncategorized,
  folderAllHiddenListIds,
  globalAllHiddenFolderIds,
  globalAllUncategorizedOnly,
  globalAllHideUncategorized,
}: {
  openTarget: OpenTarget
  openCategory: List | null
  viewList: List | null
  currentDisplay: ListDisplay
  allTasks: Task[]
  categories: List[]
  folders: Folder[]
  currentFolder: Folder | null
  itemTypes: ItemTypeDefinition[]
  getSmartTasks: (id: SmartId) => Task[]
  getTasksForCategory: (categoryId: string) => Task[]
  updateList: (list: List) => void
  hiddenItemTypeIdsByTarget: Record<string, string[]> | undefined
  folderAllUncategorizedOnly: Record<string, boolean>
  folderAllHideUncategorized: Record<string, boolean> | undefined
  folderAllHiddenListIds: Record<string, string[]> | undefined
  globalAllHiddenFolderIds: string[] | undefined
  globalAllUncategorizedOnly: boolean
  globalAllHideUncategorized: boolean
}) {
  const [showSentItems, setShowSentItems] = useState(false)
  useEffect(() => {
    setShowSentItems(false)
  }, [openCategory?.id])

  const openTasks = useMemo(() => {
    if (!openTarget) return []
    if (openTarget.type === "category") {
      return getTasksForCategory(openTarget.id)
    }
    if (openTarget.type === "folder-all" && openTarget.folderId === ROOT_ALL_FOLDER_ID) {
      let items = filterTasksHiddenFromGlobalAll(allTasks.filter((t) => !isClearedFromWork(t)), categories, folders)
      if (globalAllUncategorizedOnly) {
        return items.filter((t) => isTaskUncategorizedGlobally(t))
      }
      const hiddenFolders = globalAllHiddenFolderIds ?? []
      const hideUncategorized = !!globalAllHideUncategorized
      if (hiddenFolders.length || hideUncategorized) {
        items = filterTasksByHiddenGlobalFolders(items, folders, hiddenFolders, categories, hideUncategorized)
      }
      return items
    }
    if (openTarget.type === "folder-all" && currentFolder) {
      if (isScheduledFolderId(currentFolder.id)) return getTasksForScheduledFolder(allTasks, currentFolder.id)
      let items = getTasksForFolderAllView(allTasks, currentFolder)
      if (folderAllUncategorizedOnly[currentFolder.id]) {
        return items.filter((t) => isTaskUncategorizedInFolder(t, currentFolder))
      }
      const hidden = folderAllHiddenListIds?.[currentFolder.id] ?? []
      const hideUncategorized = !!folderAllHideUncategorized?.[currentFolder.id]
      if (hidden.length || hideUncategorized) {
        items = filterTasksByHiddenFolderLists(items, currentFolder, hidden, undefined, hideUncategorized)
      }
      return items
    }
    if (openTarget.type === "smart") return getSmartTasks(openTarget.id)
    if (openTarget.type === "item-type") return tasksOfItemType(openTarget.id, allTasks, itemTypes)
    return []
  }, [openTarget, allTasks, categories, folders, currentFolder, folderAllUncategorizedOnly, folderAllHideUncategorized, folderAllHiddenListIds, globalAllHiddenFolderIds, globalAllUncategorizedOnly, globalAllHideUncategorized, getSmartTasks, getTasksForCategory, itemTypes])

  const listedTasks = useMemo(() => {
    // A step's item never shows in Lists (Phase 11); its step is in its task.
    let tasks = withoutStepItems(
      openTarget?.type === "category" && openCategory?.sentThisWeek && !showSentItems
        ? visibleListItems(openTasks, openCategory.id, false)
        : openTasks,
    )
    if (!openTarget || openTarget.type === "habits" || openTarget.type === "objectives") return tasks
    const targetKey = openTargetKey(openTarget)
    const hiddenTypes = hiddenItemTypeIdsByTarget?.[targetKey]
    if (hiddenTypes?.length) {
      tasks = filterTasksByHiddenItemTypes(tasks, hiddenTypes, openCategory)
    }
    return tasks
  }, [
    openTasks,
    openTarget,
    openCategory,
    showSentItems,
    hiddenItemTypeIdsByTarget,
  ])

  const typeFilterForOpen = useMemo(() => {
    if (!openTarget || openTarget.type === "habits" || openTarget.type === "objectives") return null
    const presentIds = typesPresentInTasks(openTasks, openCategory)
    const allowedCount = openCategory ? listAllowedTypeIds(openCategory).length : 0
    if (!shouldShowTypeFilter({ presentTypeCount: presentIds.length, allowedTypeCount: allowedCount })) {
      return null
    }
    // Prefer allowlist union present so empty multi-type lists still offer filters.
    const ids =
      openCategory && allowedCount >= 2
        ? [...new Set([...listAllowedTypeIds(openCategory).map(String), ...presentIds])].sort((a, b) =>
            a.localeCompare(b),
          )
        : presentIds
    return {
      targetKey: openTargetKey(openTarget),
      items: typeFilterItems(ids, itemTypes),
    }
  }, [openTarget, openTasks, openCategory, itemTypes])

  // ---- One-list caption search + Default sort (DEFAULT_VIEW.md) ----
  const openKeyForSearch = openTarget ? openTargetKey(openTarget) : ""
  const [listSearchOpen, setListSearchOpen] = useState(false)
  const [listSearchQuery, setListSearchQuery] = useState("")
  const [listSearchAllFields, setListSearchAllFields] = useState(false)
  useEffect(() => {
    setListSearchOpen(false)
    setListSearchQuery("")
  }, [openKeyForSearch])
  const closeListSearch = useCallback(() => {
    setListSearchOpen(false)
    setListSearchQuery("")
  }, [])
  const listSearchable =
    !!openTarget && openTarget.type !== "habits" && openTarget.type !== "objectives"

  const listSchemaDefs = useMemo<AttributeDefinition[]>(() => {
    if (!listSearchable) return []
    const base = openCategory
      ? listAttributeSchema(openCategory, itemTypes)
      : mergeListAttributes(categories, [...new Set(listedTasks.flatMap((t) => t.lists ?? []))], itemTypes)
    const seen = new Set(base.map((d) => d.id))
    const out = [...base]
    for (const t of listedTasks) {
      for (const d of t.itemAttributeDefinitions ?? []) {
        if (d?.id && !seen.has(d.id)) {
          seen.add(d.id)
          out.push(d)
        }
      }
    }
    return out
  }, [listSearchable, openCategory, categories, listedTasks, itemTypes])

  // Lists without a List record (smart lists) keep their sort for this session only.
  const [sessionSorts, setSessionSorts] = useState<Record<string, ListItemSort | undefined>>({})
  const currentSort: ListItemSort | undefined = viewList
    ? resolveDefaultViewSort(viewList.defaultView)
    : openKeyForSearch
      ? sessionSorts[openKeyForSearch]
      : undefined
  const handleSortChange = useCallback(
    (sort: ListItemSort | undefined) => {
      if (viewList) {
        updateList({ ...viewList, defaultView: setDefaultViewSort(viewList.defaultView, sort) })
        return
      }
      if (openKeyForSearch) setSessionSorts((prev) => ({ ...prev, [openKeyForSearch]: sort }))
    },
    [viewList, openKeyForSearch, updateList],
  )
  const sortOptions = useMemo(() => listItemSortOptions(listSchemaDefs), [listSchemaDefs])

  const shownTasks = useMemo(() => {
    let tasks = listSearchQuery.trim()
      ? filterListItemsBySearch(listedTasks, listSearchQuery, { allFields: listSearchAllFields, defs: listSchemaDefs })
      : listedTasks
    if (currentDisplay === "default" && currentSort) {
      tasks = sortListItems(tasks, currentSort, {
        listId: openCategory?.id ?? null,
        defs: listSchemaDefs,
        typeName: (t) => getItemType(itemTypes, t.type ?? openCategory?.itemTypeId).name,
      })
    }
    return tasks
  }, [listedTasks, listSearchQuery, listSearchAllFields, listSchemaDefs, currentDisplay, currentSort, openCategory, itemTypes])

  return {
    showSentItems,
    setShowSentItems,
    openTasks,
    listedTasks,
    typeFilterForOpen,
    listSearchOpen,
    setListSearchOpen,
    listSearchQuery,
    setListSearchQuery,
    listSearchAllFields,
    setListSearchAllFields,
    closeListSearch,
    listSearchable,
    currentSort,
    handleSortChange,
    sortOptions,
    shownTasks,
  }
}
