/**
 * components/Lists/hooks/useOpenListItems.ts
 *
 * One pipeline for the open list: membership, type filter, caption search,
 * and Default sort. Search resets when the open target changes. Sort persists
 * on the list record, or for this session when the target has no List record.
 * Home All starts from the shelf's cached row set. Past 800 rows, item-only
 * sort traits and the type filter fill in after the rows paint.
 * The orchestrator passes chrome and store values in. This hook does not subscribe.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import type { ListDisplay } from "@/lib/lists-ui-store"
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
import { selectGlobalAllItems } from "@/lib/module-lists"
import {
  effectiveItemTypeId,
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
import { filterListItemsBySearch, listItemSortOptions, sortAttrId, sortListItems } from "@/lib/list-item-sort"
import { listAttributeSchema, mergeListAttributes } from "@/components/Lists/attribute-editor"
import { openTargetKey } from "@/components/Lists/open-target"
import type { OpenTarget, SmartId } from "@/components/Lists/types"
import { withoutStepItems } from "@/lib/step-item-guard"

/** Past this, item-only sort traits and the type filter fill in after the rows paint. */
const LARGE_OPEN_LIST = 800
const EMPTY_DEFS: AttributeDefinition[] = []

function scheduleIdle(work: () => void): () => void {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(work, { timeout: 400 })
    return () => cancelIdleCallback(id)
  }
  const id = setTimeout(work, 32)
  return () => clearTimeout(id)
}

/**
 * List schemas and item-only defs for a huge open set, collected after paint.
 * The scan reads list ids and definition rows, not notes or attribute values.
 */
function useDeferredOpenSchema(
  tasks: readonly Task[],
  categories: List[],
  itemTypes: ItemTypeDefinition[],
  defer: boolean,
): AttributeDefinition[] {
  const [found, setFound] = useState<{ tasks: readonly Task[]; defs: AttributeDefinition[] } | null>(null)
  useEffect(() => {
    if (!defer) return
    let cancel = false
    let i = 0
    const listIds = new Set<string>()
    const seen = new Set<string>()
    const itemDefs: AttributeDefinition[] = []
    let stop = () => {}
    const step = () => {
      if (cancel) return
      const end = Math.min(tasks.length, i + 4000)
      for (; i < end; i++) {
        const task = tasks[i]
        const ids = task.lists
        if (ids) for (const id of ids) listIds.add(id)
        const rows = task.itemAttributeDefinitions
        if (!rows) continue
        for (const d of rows) {
          if (!d?.id || seen.has(d.id)) continue
          seen.add(d.id)
          itemDefs.push(d)
        }
      }
      if (i < tasks.length) {
        stop = scheduleIdle(step)
        return
      }
      if (cancel) return
      const fromLists = mergeListAttributes(categories, [...listIds], itemTypes)
      const defs = [...fromLists]
      const have = new Set(fromLists.map((d) => d.id))
      for (const d of itemDefs) {
        if (d.id && !have.has(d.id)) defs.push(d)
      }
      setFound({ tasks, defs })
    }
    stop = scheduleIdle(step)
    return () => {
      cancel = true
      stop()
    }
  }, [defer, tasks, categories, itemTypes])
  if (!defer) return EMPTY_DEFS
  return found && found.tasks === tasks ? found.defs : EMPTY_DEFS
}

/** Distinct type ids, collected after paint on a large open list. */
function useDeferredPresentTypes(tasks: readonly Task[], openList: List | null, defer: boolean): string[] | null {
  const [found, setFound] = useState<{ tasks: readonly Task[]; ids: string[] } | null>(null)
  useEffect(() => {
    if (!defer) return
    let cancel = false
    let i = 0
    const seen = new Set<string>()
    let stop = () => {}
    const step = () => {
      if (cancel) return
      const end = Math.min(tasks.length, i + 8000)
      for (; i < end; i++) seen.add(effectiveItemTypeId(tasks[i], openList))
      if (i < tasks.length) {
        stop = scheduleIdle(step)
        return
      }
      if (!cancel) setFound({ tasks, ids: [...seen].sort((a, b) => a.localeCompare(b)) })
    }
    stop = scheduleIdle(step)
    return () => {
      cancel = true
      stop()
    }
  }, [defer, tasks, openList])
  if (!defer) return null
  return found && found.tasks === tasks ? found.ids : null
}

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
  globalAllTasks,
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
  /** Cached Home All rows from the shelf. Falls back to a fresh pass when omitted. */
  globalAllTasks?: Task[]
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
      let items = globalAllTasks ?? selectGlobalAllItems(allTasks, categories, folders)
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
  }, [openTarget, allTasks, categories, folders, currentFolder, folderAllUncategorizedOnly, folderAllHideUncategorized, folderAllHiddenListIds, globalAllHiddenFolderIds, globalAllUncategorizedOnly, globalAllHideUncategorized, globalAllTasks, getSmartTasks, getTasksForCategory, itemTypes])

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

  const listSurface = !!openTarget && openTarget.type !== "habits" && openTarget.type !== "objectives"
  const largeOpen = openTasks.length > LARGE_OPEN_LIST
  const deferredTypeIds = useDeferredPresentTypes(openTasks, openCategory, largeOpen && listSurface)

  const typeFilterForOpen = useMemo(() => {
    if (!listSurface || !openTarget) return null
    const allowedCount = openCategory ? listAllowedTypeIds(openCategory).length : 0
    const presentIds = largeOpen ? deferredTypeIds : typesPresentInTasks(openTasks, openCategory)
    // A huge list paints first. The type checkboxes appear when the scan finishes.
    if (presentIds == null && allowedCount < 2) return null
    const present = presentIds ?? []
    if (!shouldShowTypeFilter({ presentTypeCount: present.length, allowedTypeCount: allowedCount })) {
      return null
    }
    // Prefer allowlist union present so empty multi-type lists still offer filters.
    const ids =
      openCategory && allowedCount >= 2
        ? [...new Set([...listAllowedTypeIds(openCategory).map(String), ...present])].sort((a, b) =>
            a.localeCompare(b),
          )
        : present
    return {
      targetKey: openTargetKey(openTarget),
      items: typeFilterItems(ids, itemTypes),
    }
  }, [listSurface, openTarget, openTasks, openCategory, itemTypes, largeOpen, deferredTypeIds])

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

  const largeListed = listedTasks.length > LARGE_OPEN_LIST
  const deferredSchema = useDeferredOpenSchema(listedTasks, categories, itemTypes, listSearchable && largeListed)

  const listSchemaDefs = useMemo<AttributeDefinition[]>(() => {
    if (!listSearchable) return EMPTY_DEFS
    const schemaList = openCategory ?? (largeListed ? viewList : null)
    const base = schemaList
      ? listAttributeSchema(schemaList, itemTypes)
      : largeListed
        ? EMPTY_DEFS
        : mergeListAttributes(categories, [...new Set(listedTasks.flatMap((t) => t.lists ?? []))], itemTypes)
    const seen = new Set(base.map((d) => d.id))
    const out = [...base]
    const extras = largeListed ? deferredSchema : null
    if (extras) {
      for (const d of extras) {
        if (d?.id && !seen.has(d.id)) {
          seen.add(d.id)
          out.push(d)
        }
      }
      return out
    }
    for (const t of listedTasks) {
      for (const d of t.itemAttributeDefinitions ?? []) {
        if (d?.id && !seen.has(d.id)) {
          seen.add(d.id)
          out.push(d)
        }
      }
    }
    return out
  }, [listSearchable, openCategory, viewList, categories, listedTasks, itemTypes, largeListed, deferredSchema])

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
  const schemaMatters =
    (!!listSearchQuery.trim() && listSearchAllFields) || (!!currentSort && sortAttrId(currentSort.key) != null)
  const rowDefs = schemaMatters ? listSchemaDefs : EMPTY_DEFS

  const shownTasks = useMemo(() => {
    let tasks = listSearchQuery.trim()
      ? filterListItemsBySearch(listedTasks, listSearchQuery, { allFields: listSearchAllFields, defs: rowDefs })
      : listedTasks
    if (currentDisplay === "default" && currentSort) {
      tasks = sortListItems(tasks, currentSort, {
        listId: openCategory?.id ?? null,
        defs: rowDefs,
        typeName: (t) => getItemType(itemTypes, t.type ?? openCategory?.itemTypeId).name,
      })
    }
    return tasks
  }, [listedTasks, listSearchQuery, listSearchAllFields, rowDefs, currentDisplay, currentSort, openCategory, itemTypes])

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
