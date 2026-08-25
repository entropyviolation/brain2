/**
 * components/Lists/enhanced-list-view.tsx — Lists board orchestrator
 *
 * Composes hooks, views, dialogs, and navigation for the retro File Manager UI.
 * Spec: §6 (Next Actions / Lists).
 */
"use client"

import type React from "react"
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { useItemTypeStore } from "@/lib/item-type-store"
import { useListsUiStore, type ListDisplay } from "@/lib/lists-ui-store"
import { inferColumnType } from "@/lib/csv"
import { parseSpreadsheetFile } from "@/lib/spreadsheet-file"
import {
  capitalizeLabel,
  getItemLabel,
} from "@/lib/item-utils"
import {
  syncNextActionsSmartLists,
  syncScheduledFolderHierarchy,
  isNaSmartCategoryId,
  naSmartIdToPeriod,
  isScheduledFolderId,
  getTasksForScheduledFolder,
} from "@/lib/scheduled-lists-sync"
import {
  syncFolderAllItemsCategories,
  getTasksForFolderAllView,
  isTaskUncategorizedInFolder,
  isTaskUncategorizedGlobally,
  filterTasksByHiddenFolderLists,
  filterTasksByHiddenGlobalFolders,
} from "@/lib/folder-all-items"
import { buildGridEntries, ROOT_ALL_FOLDER_ID } from "@/lib/lists-grid-entries"
import { destinationFoldersForSelection, originFolderIdToUnlink, wouldCreateFolderCycle, type ListPlacementMode } from "@/lib/folder-selection"
import {
  canMoveItemsFromOpenList,
  excludedListIdsForSelection,
  placeTaskInList,
  type ItemPlacementMode,
} from "@/lib/item-selection"
import { applyListMerge, type ListMergePlan } from "@/lib/list-merge"
import { applyItemMerge, itemMergeLabel, type ItemMergePlan } from "@/lib/item-merge"
import { selectableEntryIds } from "@/lib/lists-folder-search"
import {
  buildListsTaskIndex,
  completionRateForList,
  smartTasksFor,
  tasksForList,
  type ListsTaskIndex,
} from "@/lib/lists-task-index"
import { TaskDetailPopup } from "@/components/task-detail-popup"
import { NextActionsSettingsDialog } from "@/components/Lists/settings-dialog"
import { DailyHabitsList, WeeklyHabitsList, MonthlyHabitsList } from "@/components/Lists/daily-habits-list"
import { ObjectivesList } from "@/components/Lists/objectives-list"
import { useGoalsStore } from "@/lib/goals-store"
import { useModulesStore } from "@/lib/modules-store"
import {
  filterTasksHiddenFromGlobalAll,
  syncModuleListFolders,
  taskStoreModuleListsMutators,
} from "@/lib/module-lists"
import { useListsNavigation } from "@/components/Lists/hooks/useListsNavigation"
import { useListsSearch } from "@/components/Lists/hooks/useListsSearch"
import { useListsDragDrop } from "@/components/Lists/hooks/useListsDragDrop"
import { useListsSelection } from "@/components/Lists/hooks/useListsSelection"
import { useListsTaskActions } from "@/components/Lists/hooks/useListsTaskActions"
import { FolderTree } from "@/components/Lists/navigation/FolderTree"
import { getBreadcrumb } from "@/components/Lists/navigation/BreadcrumbNav"
import { ListsToolbar } from "@/components/Lists/toolbar/ListsToolbar"
import { SelectionToolbar } from "@/components/Lists/toolbar/SelectionToolbar"
import { ItemSelectionToolbar } from "@/components/Lists/toolbar/ItemSelectionToolbar"
import { FolderViewIcons } from "@/components/Lists/views/FolderViewIcons"
import { FolderViewList } from "@/components/Lists/views/FolderViewList"
import { FolderViewDetails } from "@/components/Lists/views/FolderViewDetails"
import { FolderViewCards } from "@/components/Lists/views/FolderViewCards"
import { SearchResultsView } from "@/components/Lists/views/SearchResultsView"
import { ListContentPanel } from "@/components/Lists/list-content/ListContentPanel"
import { CompletedTasksDialog } from "@/components/Lists/dialogs/CompletedTasksDialog"
import { OrbPickerDialog } from "@/components/Lists/dialogs/OrbPickerDialog"
import { CsvImportDialog } from "@/components/Lists/dialogs/CsvImportDialog"
import { NewListDialog } from "@/components/Lists/dialogs/NewListDialog"
import { NewFolderDialog } from "@/components/Lists/dialogs/NewFolderDialog"
import { MergeListsConfirmDialog } from "@/components/Lists/dialogs/MergeListsConfirmDialog"
import { MergeListsDialog } from "@/components/Lists/dialogs/MergeListsDialog"
import { MergeItemsConfirmDialog } from "@/components/Lists/dialogs/MergeItemsConfirmDialog"
import { MergeItemsDialog } from "@/components/Lists/dialogs/MergeItemsDialog"
import { EditListDialog } from "@/components/Lists/dialogs/EditListDialog"
import { EditFolderDialog } from "@/components/Lists/dialogs/EditFolderDialog"
import { LIST_TEMPLATES, SMART_LISTS, PRESET_ICON_POSITIONS } from "@/components/Lists/constants"
import { iconFor, orbFor } from "@/components/Lists/lib/icon-utils"
import { openTargetKey } from "@/components/Lists/open-target"
import type { CsvImportState, IconPickerTarget, SmartId } from "@/components/Lists/types"
import { isListDisplayMode, sanitizeEnabledDisplays, type List, type Folder, type Task, type AttributeValue } from "@/lib/types"
import { hashIconSlot } from "@/lib/string-utils"
import "./filemanager98.css"

interface EnhancedCategoryViewProps {
  onTaskSelect: (taskId: string) => void
}

export function EnhancedCategoryView({ onTaskSelect }: EnhancedCategoryViewProps) {
  const allTasks = useTaskStore((s) => s.tasks)
  const categories = useTaskStore((s) => s.lists)
  const folders = useTaskStore((s) => s.folders)
  const addFolder = useTaskStore((s) => s.addFolder)
  const updateFolder = useTaskStore((s) => s.updateFolder)
  const deleteFolder = useTaskStore((s) => s.deleteFolder)
  const addListToFolder = useTaskStore((s) => s.addListToFolder)
  const removeListFromFolder = useTaskStore((s) => s.removeListFromFolder)
  const addList = useTaskStore((s) => s.addList)
  const updateList = useTaskStore((s) => s.updateList)
  const deleteList = useTaskStore((s) => s.deleteList)
  const deleteTask = useTaskStore((s) => s.deleteTask)
  const setLists = useTaskStore((s) => s.setLists)
  const setFolders = useTaskStore((s) => s.setFolders)
  const setTasks = useTaskStore((s) => s.setTasks)
  const updateTask = useTaskStore((s) => s.updateTask)
  const addTask = useTaskStore((s) => s.addTask)
  const dedupeFolders = useTaskStore((s) => s.dedupeFolders)
  const dedupeLists = useTaskStore((s) => s.dedupeLists)
  const itemTypes = useItemTypeStore((s) => s.types)
  const objectiveCount = useGoalsStore((s) => s.objectives.filter((o) => !o.archived).length)
  const modules = useModulesStore((s) => s.modules)

  const homePinned = useListsUiStore((s) => s.homePinned)
  const toggleHomePin = useListsUiStore((s) => s.toggleHomePin)
  const showSmartLists = useListsUiStore((s) => s.showSmartLists)
  const setShowSmartLists = useListsUiStore((s) => s.setShowSmartLists)
  const listDisplay = useListsUiStore((s) => s.listDisplay)
  const setListDisplay = useListsUiStore((s) => s.setListDisplay)
  const folderView = useListsUiStore((s) => s.folderView)
  const setFolderView = useListsUiStore((s) => s.setFolderView)
  const setIconPosition = useListsUiStore((s) => s.setIconPosition)
  const iconPositions = useListsUiStore((s) => s.iconPositions)
  const autoOrganizeIcons = useListsUiStore((s) => s.autoOrganizeIcons)
  const folderAllUncategorizedOnly = useListsUiStore((s) => s.folderAllUncategorizedOnly)
  const setFolderAllUncategorizedOnly = useListsUiStore((s) => s.setFolderAllUncategorizedOnly)
  const folderAllHiddenListIds = useListsUiStore((s) => s.folderAllHiddenListIds)
  const setFolderAllListHidden = useListsUiStore((s) => s.setFolderAllListHidden)
  const globalAllHiddenFolderIds = useListsUiStore((s) => s.globalAllHiddenFolderIds)
  const setGlobalAllFolderHidden = useListsUiStore((s) => s.setGlobalAllFolderHidden)
  const globalAllUncategorizedOnly = useListsUiStore((s) => s.globalAllUncategorizedOnly)
  const setGlobalAllUncategorizedOnly = useListsUiStore((s) => s.setGlobalAllUncategorizedOnly)

  const nav = useListsNavigation(categories, folders)
  const search = useListsSearch(folders, categories, allTasks)
  const drag = useListsDragDrop({ folders, lists: categories, types: itemTypes, updateTask, addListToFolder, removeListFromFolder })
  const selection = useListsSelection()
  const taskActions = useListsTaskActions(categories, folders, addTask, itemTypes)

  const [newCategoryOpen, setNewCategoryOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<List | null>(null)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryDescription, setNewCategoryDescription] = useState("")
  const [newCategoryColor, setNewCategoryColor] = useState("#3B82F6")
  const [newCategoryScheduleable, setNewCategoryScheduleable] = useState(true)
  const [newCategoryTemplate, setNewCategoryTemplate] = useState("none")
  const csvRef = useRef<HTMLInputElement>(null)
  const [csvImport, setCsvImport] = useState<CsvImportState | null>(null)
  const [addingTaskToTarget, setAddingTaskToTarget] = useState<string | null>(null)
  const [newTaskDescription, setNewTaskDescription] = useState("")
  const [showBulkAdd, setShowBulkAdd] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [showCategorySettings, setShowCategorySettings] = useState(false)
  const [showCompletedTasks, setShowCompletedTasks] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [newFolderColor, setNewFolderColor] = useState("#3B82F6")
  const [newFolderScheduleable, setNewFolderScheduleable] = useState(true)
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false)
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null)
  const [iconPickerFor, setIconPickerFor] = useState<IconPickerTarget>(null)
  const [organizeEpoch, setOrganizeEpoch] = useState(0)
  const [organizeFromSnapshot, setOrganizeFromSnapshot] = useState<Record<string, { x: number; y: number }> | null>(
    null,
  )

  const { location, openTarget, setOpenTarget, closeTarget, isHome, isAll, currentFolder, navTo, openEntry, activeIconId, setActiveIconId, setLocation } = nav
  const { searchTerm, setSearchTerm, searchActive, searchResults } = search
  const { selectMode, selectedCategories, setSelectedCategories, selectedFolderIds, selectedTaskIds, toggleSelectMode, toggleCategorySelection, toggleFolderSelection, toggleTaskSelection, selectAll, selectAllTasks, clearSelection, clearTaskSelection } = selection
  const [placementMode, setPlacementMode] = useState<ListPlacementMode>("keep")
  const [itemPlacementMode, setItemPlacementMode] = useState<ItemPlacementMode>("keep")
  const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [itemMergeConfirmOpen, setItemMergeConfirmOpen] = useState(false)
  const [itemMergeOpen, setItemMergeOpen] = useState(false)

  useEffect(() => {
    dedupeFolders()
    dedupeLists()
  }, [dedupeFolders, dedupeLists])

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

  useEffect(() => {
    let cancelled = false
    const frame = requestAnimationFrame(() => {
      if (cancelled) return
      startTransition(() => {
        const state = useTaskStore.getState()
        const mut = {
          lists: state.lists,
          folders: state.folders,
          addList: state.addList,
          updateList: state.updateList,
          addFolder: state.addFolder,
          updateFolder: state.updateFolder,
          deleteFolder: state.deleteFolder,
        }
        syncNextActionsSmartLists(mut)
        syncScheduledFolderHierarchy(allTasks, mut)
        syncFolderAllItemsCategories(mut)
        syncModuleListFolders(taskStoreModuleListsMutators(), modules)
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [allTasks, modules])

  const getSmartTasks = useCallback(
    (id: SmartId) => smartTasksFor(taskIndex, id),
    [taskIndex],
  )

  const getTasksForCategory = useCallback(
    (categoryId: string) => tasksForList(taskIndex, categoryId),
    [taskIndex],
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

  const entries = useMemo(
    () =>
      buildGridEntries({
        isHome,
        isAll,
        currentFolder,
        folders,
        categories,
        homePinned,
        showSmartLists,
        allTasks,
        getSmartTasks,
        getTasksForCategory,
        countForFolder,
        objectiveCount,
      }),
    [isHome, isAll, currentFolder, folders, categories, homePinned, showSmartLists, allTasks, getSmartTasks, getTasksForCategory, countForFolder, objectiveCount],
  )

  const openCategory = openTarget?.type === "category" ? categories.find((c) => c.id === openTarget.id) || null : null
  const openSmart = openTarget?.type === "smart" ? SMART_LISTS.find((s) => s.id === openTarget.id) || null : null
  const openHabits = openTarget?.type === "habits"
  const openObjectives = openTarget?.type === "objectives"
  const openFolderAll = openTarget?.type === "folder-all"
  const isRootAll = openFolderAll && openTarget?.folderId === ROOT_ALL_FOLDER_ID
  const openName = openObjectives
    ? "Objectives"
    : openHabits
    ? openTarget?.id === "weekly-habits" ? "Weekly Habits" : openTarget?.id === "monthly-habits" ? "Monthly Habits" : "Daily Habits"
    : openFolderAll ? "All Items" : openCategory?.name || openSmart?.name || ""
  const openColor = openObjectives ? "#d97706" : openHabits ? "#0ea5e9" : isRootAll ? "#64748b" : openFolderAll ? currentFolder?.color : openCategory?.color || openSmart?.color
  const openIconKey = openCategory ? iconFor(openCategory.id, openCategory.icon) : isRootAll ? iconFor("lists-root", undefined) : openFolderAll && currentFolder ? iconFor(currentFolder.id, currentFolder.icon) : openSmart ? orbFor(openSmart.id) : openObjectives ? orbFor("objectives") : openHabits ? orbFor("daily-habits") : orbFor("lists-root")

  const rawDisplay: ListDisplay = (() => {
    if (!openTarget || openTarget.type === "habits" || openTarget.type === "objectives") return "default"
    const saved = listDisplay[openTargetKey(openTarget)]
    if (saved && isListDisplayMode(saved)) return saved
    return openSmart ? "checklist" : "default"
  })()
  // If the list no longer offers the saved active display, fall back to the
  // first display it does offer (Feature 1: per-list display offerings).
  const offeredDisplays = sanitizeEnabledDisplays(openCategory?.enabledDisplays)
  const currentDisplay: ListDisplay =
    offeredDisplays && !offeredDisplays.includes(rawDisplay) ? offeredDisplays[0] : rawDisplay

  const openTasks = useMemo(() => {
    if (!openTarget) return []
    if (openTarget.type === "category") {
      if (isNaSmartCategoryId(openTarget.id)) {
        const p = naSmartIdToPeriod(openTarget.id)
        return p ? getSmartTasks(p) : []
      }
      return getTasksForCategory(openTarget.id)
    }
    if (openTarget.type === "folder-all" && openTarget.folderId === ROOT_ALL_FOLDER_ID) {
      let items = filterTasksHiddenFromGlobalAll(allTasks.filter((t) => !t.completed), categories, folders)
      if (globalAllUncategorizedOnly) items = items.filter((t) => isTaskUncategorizedGlobally(t))
      const hiddenFolders = globalAllHiddenFolderIds ?? []
      if (hiddenFolders.length) items = filterTasksByHiddenGlobalFolders(items, folders, hiddenFolders, categories)
      return items
    }
    if (openTarget.type === "folder-all" && currentFolder) {
      if (isScheduledFolderId(currentFolder.id)) return getTasksForScheduledFolder(allTasks, currentFolder.id)
      let items = getTasksForFolderAllView(allTasks, currentFolder)
      if (folderAllUncategorizedOnly[currentFolder.id]) items = items.filter((t) => isTaskUncategorizedInFolder(t, currentFolder))
      const hidden = folderAllHiddenListIds?.[currentFolder.id]
      if (hidden?.length) items = filterTasksByHiddenFolderLists(items, currentFolder, hidden)
      return items
    }
    if (openTarget.type === "smart") return getSmartTasks(openTarget.id)
    return []
  }, [openTarget, allTasks, categories, folders, currentFolder, folderAllUncategorizedOnly, folderAllHiddenListIds, globalAllHiddenFolderIds, globalAllUncategorizedOnly, getSmartTasks, getTasksForCategory])

  const breadcrumb = getBreadcrumb({ searchActive, searchTerm, openTarget, openName, isHome, isAll, currentFolderName: currentFolder?.name })
  const statusText = openTarget ? `${openTasks.length} item(s) in "${openName}"` : `${entries.filter((e) => e.kind === "folder").length} folder(s), ${entries.filter((e) => e.kind !== "folder").length} list(s)`

  const openNewCategoryDialog = useCallback(() => {
    setNewCategoryName("")
    setNewCategoryDescription(currentFolder?.description || "")
    setNewCategoryColor(currentFolder?.color || "#3B82F6")
    setNewCategoryScheduleable(currentFolder ? currentFolder.scheduleable !== false : true)
    setNewCategoryOpen(true)
  }, [currentFolder])

  const handleCreateCategory = useCallback(() => {
    if (!newCategoryName.trim()) return
    const id = Date.now().toString()
    const template = LIST_TEMPLATES[newCategoryTemplate]
    addList({
      id,
      name: newCategoryName,
      color: newCategoryColor,
      description: newCategoryDescription,
      createdAt: new Date(),
      order: categories.length,
      scheduleable: newCategoryScheduleable,
      itemAttributes: template?.attributes.length ? template.attributes.map((a) => ({ ...a })) : undefined,
    })
    if (currentFolder) addListToFolder(currentFolder.id, id)
    if (isHome) toggleHomePin(id)
    if (selectedTaskIds.length > 0) {
      const state = useTaskStore.getState()
      const originListId = openTarget?.type === "category" ? openTarget.id : null
      const canMove = canMoveItemsFromOpenList(originListId)
      const mode: ItemPlacementMode = canMove ? itemPlacementMode : "keep"
      selectedTaskIds.forEach((taskId) => {
        const t = state.tasks.find((x) => x.id === taskId)
        if (!t) return
        updateTask(
          placeTaskInList(t, id, {
            mode,
            originListId,
            canMove,
            lists: state.lists,
            folders: state.folders,
            types: itemTypes,
          }),
        )
      })
      selection.cancelSelectMode()
    }
    setNewCategoryOpen(false)
    setNewCategoryName("")
    setNewCategoryDescription("")
    setNewCategoryColor("#3B82F6")
    setNewCategoryScheduleable(true)
    setNewCategoryTemplate("none")
  }, [newCategoryName, newCategoryColor, newCategoryDescription, newCategoryScheduleable, newCategoryTemplate, addList, categories.length, currentFolder, addListToFolder, isHome, toggleHomePin, selectedTaskIds, openTarget, itemPlacementMode, updateTask, itemTypes, selection])

  const handleEditCategory = useCallback(() => {
    if (editingCategory) {
      updateList(editingCategory)
      setEditingCategory(null)
    }
  }, [editingCategory, updateList])

  const handleCsvFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    void (async () => {
      try {
        const { headers, rows } = await parseSpreadsheetFile(file)
        if (headers.length === 0) return
        const lower = headers.map((h) => h.toLowerCase())
        const nameCandidates = ["name", "title", "item", "task", "description", "book", "product"]
        let nameCol = lower.findIndex((h) => nameCandidates.some((c) => h.includes(c)))
        if (nameCol === -1) nameCol = 0
        const listName = file.name.replace(/\.(csv|tsv|txt|xlsx|xls)$/i, "")
        setCsvImport({ fileName: file.name, headers, rows, listName, nameCol, targetCategoryId: "" })
      } catch (err) {
        console.error("Failed to parse spreadsheet", err)
        window.alert("Could not read that spreadsheet. Try exporting as CSV or XLSX and upload again.")
      }
    })()
    if (csvRef.current) csvRef.current.value = ""
  }, [])

  const performCsvImport = useCallback(() => {
    if (!csvImport) return
    const { headers, rows, nameCol, listName, targetCategoryId } = csvImport
    const slug = (s: string) => "attr_" + s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
    const attrDefs = headers
      .map((h, i) => ({ h, i }))
      .filter(({ i }) => i !== nameCol)
      .map(({ h, i }) => ({ id: slug(h) || `attr_${i}`, name: h || `Column ${i + 1}`, type: inferColumnType(h, rows.map((r) => r[i] ?? "")) }))
    let categoryId = targetCategoryId
    if (!categoryId) {
      categoryId = Date.now().toString()
      addList({
        id: categoryId,
        name: listName || "Imported list",
        color: newCategoryColor,
        description: `Imported from ${csvImport.fileName}`,
        createdAt: new Date(),
        order: categories.length,
        scheduleable: true,
        itemAttributes: attrDefs,
      })
      if (currentFolder) addListToFolder(currentFolder.id, categoryId)
      if (isHome) toggleHomePin(categoryId)
    } else {
      const existing = categories.find((c) => c.id === categoryId)
      if (existing) {
        const merged = [...(existing.itemAttributes || [])]
        attrDefs.forEach((d) => { if (!merged.some((m) => m.id === d.id)) merged.push(d) })
        const displays = existing.enabledDisplays
        updateList({
          ...existing,
          itemAttributes: merged,
          // Ensure spreadsheet view is available after a sheet import.
          enabledDisplays:
            displays && displays.length > 0 && !displays.includes("spreadsheet")
              ? [...displays, "spreadsheet"]
              : displays,
        })
      }
    }
    rows.forEach((row, idx) => {
      const description = (row[nameCol] || "").trim() || `Row ${idx + 1}`
      const base = taskActions.buildBaseTask(description)
      base.lists = [categoryId]
      const attributes: Record<string, AttributeValue> = {}
      headers.forEach((h, i) => {
        if (i === nameCol) return
        const def = attrDefs.find((d) => d.id === (slug(h) || `attr_${i}`))
        if (!def) return
        const raw = (row[i] ?? "").trim()
        if (raw === "") return
        attributes[def.id] = def.type === "number" ? Number(raw.replace(/[$,]/g, "")) || 0 : raw
      })
      base.attributes = attributes
      addTask(base)
    })
    // Open the imported list in spreadsheet view so the grid matches the file.
    setListDisplay(categoryId, "spreadsheet")
    setOpenTarget({ type: "category", id: categoryId })
    setCsvImport(null)
  }, [csvImport, addList, addTask, updateList, categories, newCategoryColor, currentFolder, addListToFolder, isHome, toggleHomePin, taskActions, setListDisplay, setOpenTarget])

  const applyIcon = (icon: string | undefined) => {
    if (!iconPickerFor) return
    if (iconPickerFor.kind === "category") {
      const c = categories.find((x) => x.id === iconPickerFor.id)
      if (c) updateList({ ...c, icon })
    } else if (iconPickerFor.kind === "folder") {
      const f = folders.find((x) => x.id === iconPickerFor.id)
      if (f) updateFolder({ ...f, icon })
    } else {
      const t = allTasks.find((x) => x.id === iconPickerFor.id)
      if (t) updateTask({ ...t, icon })
    }
    setIconPickerFor(null)
  }

  const handleAutoOrganize = useCallback(() => {
    const snap: Record<string, { x: number; y: number }> = {}
    for (const e of entries) {
      const key = `${e.kind}-${e.id}`
      snap[key] =
        iconPositions[`${location}:${key}`] ?? PRESET_ICON_POSITIONS[key] ?? hashIconSlot(key)
    }
    setOrganizeFromSnapshot(snap)
    autoOrganizeIcons(
      location,
      entries.map((e) => `${e.kind}-${e.id}`),
    )
    setOrganizeEpoch((n) => n + 1)
  }, [autoOrganizeIcons, location, entries, iconPositions])

  const iconPickerCurrent = useMemo(() => {
    if (!iconPickerFor) return undefined
    if (iconPickerFor.kind === "category") return categories.find((x) => x.id === iconPickerFor.id)?.icon
    if (iconPickerFor.kind === "folder") return folders.find((x) => x.id === iconPickerFor.id)?.icon
    return allTasks.find((x) => x.id === iconPickerFor.id)?.icon
  }, [iconPickerFor, categories, folders, allTasks])

  const handleAddTaskToCategoryCard = useCallback(
    (categoryId: string, description: string) => {
      taskActions.handleAddTaskToCategory(categoryId, description, () => setAddingTaskToTarget(null))
    },
    [taskActions.handleAddTaskToCategory],
  )

  const effectivePlacement: ListPlacementMode = isAll ? "keep" : placementMode

  const placeListsIntoFolder = useCallback(
    (destFolderId: string) => {
      selectedCategories.forEach((catId) => addListToFolder(destFolderId, catId))
      const unlink = originFolderIdToUnlink({ mode: effectivePlacement, originFolderId: currentFolder?.id, isAll })
      if (unlink && unlink !== destFolderId) {
        selectedCategories.forEach((catId) => removeListFromFolder(unlink, catId))
      }
      if (effectivePlacement === "move") {
        selectedFolderIds.forEach((fid) => {
          if (wouldCreateFolderCycle(folders, fid, destFolderId)) return
          const child = folders.find((f) => f.id === fid)
          if (child) updateFolder({ ...child, parentFolderId: destFolderId })
        })
      }
      selection.cancelSelectMode()
    },
    [
      selectedCategories,
      selectedFolderIds,
      addListToFolder,
      removeListFromFolder,
      effectivePlacement,
      currentFolder?.id,
      isAll,
      folders,
      updateFolder,
      selection,
    ],
  )

  const originListId = openTarget?.type === "category" ? openTarget.id : null
  const itemCanMove = canMoveItemsFromOpenList(originListId)
  const effectiveItemPlacement: ItemPlacementMode = itemCanMove ? itemPlacementMode : "keep"
  const itemSelectActive = !!(
    selectMode &&
    openTarget &&
    openTarget.type !== "habits" &&
    openTarget.type !== "objectives" &&
    !searchActive
  )
  const openListKey = openTarget && openTarget.type !== "habits" && openTarget.type !== "objectives" ? openTargetKey(openTarget) : ""
  useEffect(() => {
    clearTaskSelection()
  }, [openListKey, clearTaskSelection])

  const placeItemsIntoLists = useCallback(
    (destListIds: string[]) => {
      const unique = [...new Set(destListIds.filter(Boolean))]
      if (unique.length === 0) return
      const state = useTaskStore.getState()
      selectedTaskIds.forEach((taskId) => {
        const t = state.tasks.find((x) => x.id === taskId)
        if (!t) return
        let next = t
        for (const destListId of unique) {
          next = placeTaskInList(next, destListId, {
            mode: effectiveItemPlacement,
            originListId,
            canMove: itemCanMove,
            lists: state.lists,
            folders: state.folders,
            types: itemTypes,
          })
        }
        updateTask(next)
      })
      selection.cancelSelectMode()
    },
    [selectedTaskIds, effectiveItemPlacement, originListId, itemCanMove, updateTask, itemTypes, selection],
  )

  const handleSelectAllVisible = useCallback(() => {
    const ids = selectableEntryIds(entries)
    selectAll(ids.listIds, ids.folderIds)
  }, [entries, selectAll])

  const handleSelectAllItems = useCallback(() => {
    selectAllTasks(openTasks.map((t) => t.id))
  }, [openTasks, selectAllTasks])

  const handleDeleteSelectedItems = useCallback(() => {
    const n = selectedTaskIds.length
    if (n === 0) return
    if (!confirm(`Delete ${n} item${n === 1 ? "" : "s"}? This cannot be undone.`)) return
    selectedTaskIds.forEach((id) => deleteTask(id))
    selection.cancelSelectMode()
  }, [selectedTaskIds, deleteTask, selection])

  const handleDeleteSelected = useCallback(() => {
    const listCount = selectedCategories.length
    const folderCount = selectedFolderIds.length
    if (listCount + folderCount === 0) return
    const parts = [
      listCount ? `${listCount} list${listCount === 1 ? "" : "s"}` : "",
      folderCount ? `${folderCount} folder${folderCount === 1 ? "" : "s"}` : "",
    ].filter(Boolean)
    if (
      !confirm(
        `Delete ${parts.join(" and ")}? Items are kept. Folders are removed without deleting lists that are not also selected.`,
      )
    ) {
      return
    }
    selectedCategories.forEach((id) => {
      folders.forEach((f) => {
        if (f.listIds.includes(id)) removeListFromFolder(f.id, id)
      })
      deleteList(id)
    })
    selectedFolderIds.forEach((id) => {
      if (!isScheduledFolderId(id)) deleteFolder(id)
    })
    if (openTarget?.type === "category" && selectedCategories.includes(openTarget.id)) closeTarget()
    if (currentFolder && selectedFolderIds.includes(currentFolder.id)) navTo("all")
    selection.cancelSelectMode()
  }, [
    selectedCategories,
    selectedFolderIds,
    deleteList,
    deleteFolder,
    folders,
    removeListFromFolder,
    openTarget,
    closeTarget,
    currentFolder,
    navTo,
    selection,
  ])

  const selectedMergeLists = useMemo(
    () => selectedCategories.map((id) => categories.find((c) => c.id === id)).filter((c): c is List => !!c),
    [selectedCategories, categories],
  )

  const selectedMergeItems = useMemo(
    () => selectedTaskIds.map((id) => allTasks.find((t) => t.id === id)).filter((t): t is Task => !!t),
    [selectedTaskIds, allTasks],
  )

  const handleApplyMerge = useCallback(
    (plan: ListMergePlan) => {
      const next = applyListMerge({ lists: categories, folders, tasks: allTasks }, plan)
      setLists(next.lists)
      setFolders(next.folders)
      setTasks(next.tasks)
      setMergeOpen(false)
      selection.cancelSelectMode()
    },
    [categories, folders, allTasks, setLists, setFolders, setTasks, selection],
  )

  const handleApplyItemMerge = useCallback(
    (plan: ItemMergePlan) => {
      setTasks(applyItemMerge(allTasks, plan))
      if (selectedTaskId && plan.discardedIds.includes(selectedTaskId)) setSelectedTaskId(null)
      setItemMergeOpen(false)
      selection.cancelSelectMode()
    },
    [allTasks, setTasks, selectedTaskId, selection],
  )

  const folderViewCommon = {
    entries,
    activeIconId,
    setActiveIconId,
    openEntry,
    handleCategoryDragStart: drag.handleCategoryDragStart,
    handleDragOver: drag.handleDragOver,
    handleDropOnEntry: drag.handleDropOnEntry,
    clearDrag: drag.clearDrag,
  }

  const renderMainContent = () => {
    if (searchActive) {
      return (
        <SearchResultsView
          searchTerm={searchTerm}
          folders={searchResults.folders}
          lists={searchResults.lists}
          tasks={searchResults.tasks}
          getTasksForCategory={getTasksForCategory}
          onSelectFolder={(id) => { navTo(id); setSearchTerm("") }}
          onSelectList={(listId, parentId) => { setLocation(parentId || "all"); setOpenTarget({ type: "category", id: listId }); setSearchTerm("") }}
          onSelectTask={setSelectedTaskId}
        />
      )
    }
    if (openTarget?.type === "habits") {
      if (openTarget.id === "weekly-habits") return <WeeklyHabitsList />
      if (openTarget.id === "monthly-habits") return <MonthlyHabitsList />
      return <DailyHabitsList />
    }
    if (openTarget?.type === "objectives") return <ObjectivesList />
    if (openTarget) {
      return (
        <ListContentPanel
          tasks={openTasks}
          currentDisplay={currentDisplay}
          categories={categories}
          folders={folders}
          openCategory={openCategory}
          openFolderAll={!!openFolderAll}
          openSmart={!!openSmart}
          currentFolder={currentFolder}
          isRootAll={isRootAll}
          itemLabel={openFolderAll && currentFolder && !isRootAll ? "Item" : itemLabelFor(openCategory?.id, openCategory)}
          openIconKey={openIconKey}
          folderAllUncategorizedOnly={folderAllUncategorizedOnly}
          onFolderAllUncategorizedOnlyChange={setFolderAllUncategorizedOnly}
          folderAllHiddenListIds={folderAllHiddenListIds ?? {}}
          onFolderAllListHiddenChange={setFolderAllListHidden}
          globalAllHiddenFolderIds={globalAllHiddenFolderIds ?? []}
          onGlobalAllFolderHiddenChange={setGlobalAllFolderHidden}
          globalAllUncategorizedOnly={!!globalAllUncategorizedOnly}
          onGlobalAllUncategorizedOnlyChange={setGlobalAllUncategorizedOnly}
          addingTaskToTarget={addingTaskToTarget}
          openTargetKeyValue={openTargetKey(openTarget)}
          newTaskDescription={newTaskDescription}
          onNewTaskDescriptionChange={setNewTaskDescription}
          onAddTask={() => taskActions.handleAddTaskToOpen(newTaskDescription, openTarget, currentFolder, () => { setNewTaskDescription(""); setAddingTaskToTarget(null) })}
          onCancelAddTask={() => setAddingTaskToTarget(null)}
          showBulkAdd={showBulkAdd}
          onBulkAdd={(text) => taskActions.handleBulkAddToOpen(text, openTarget, currentFolder, () => { setShowBulkAdd(false) })}
          onShowBulkAdd={setShowBulkAdd}
          onBulkAddCancel={() => { setShowBulkAdd(false) }}
          onTaskSelect={setSelectedTaskId}
          onCompleteTask={taskActions.handleCompleteTask}
          onTaskDragStart={drag.handleTaskDragStart}
          onDragEnd={drag.clearDrag}
          onIconPickerOpen={(taskId) => setIconPickerFor({ kind: "task", id: taskId })}
          selectMode={selectMode}
          selectedTaskIds={selectedTaskIds}
          onToggleTaskSelect={toggleTaskSelection}
        />
      )
    }
    if (folderView === "icons") {
      return (
        <FolderViewIcons
          location={location}
          entries={entries}
          activeIconId={activeIconId}
          setActiveIconId={setActiveIconId}
          openEntry={openEntry}
          isHome={isHome}
          selectMode={selectMode}
          selectedCategories={selectedCategories}
          dropTargetId={drag.dropTargetId}
          homePinned={homePinned}
          iconPositions={iconPositions}
          organizeEpoch={organizeEpoch}
          organizeFromSnapshot={organizeFromSnapshot}
          onOrganizeAnimationEnd={() => setOrganizeFromSnapshot(null)}
          setIconPosition={setIconPosition}
          onFileCategoryOnEntry={(categoryId, target) => {
            if (target.kind === "folder") drag.fileCategoryIntoFolder(categoryId, target.id)
            else if (target.kind === "folder-all") drag.fileCategoryIntoFolder(categoryId, null)
          }}
          setSelectedCategories={setSelectedCategories}
          setDropTargetId={drag.setDropTargetId}
          toggleHomePin={toggleHomePin}
          setIconPickerFor={setIconPickerFor}
          openNewCategoryDialog={openNewCategoryDialog}
        />
      )
    }
    if (folderView === "list") {
      return (
        <FolderViewList
          {...folderViewCommon}
          selectMode={selectMode}
          selectedCategories={selectedCategories}
          selectedFolderIds={selectedFolderIds}
          onToggleListSelect={toggleCategorySelection}
          onToggleFolderSelect={toggleFolderSelection}
          inFolder={!!currentFolder}
        />
      )
    }
    if (folderView === "details") {
      return (
        <FolderViewDetails
          {...folderViewCommon}
          folders={folders}
          getCategoryCompletionRate={getCategoryCompletionRate}
        />
      )
    }
    return (
      <FolderViewCards
        {...folderViewCommon}
        categoryById={categoryById}
        selectMode={selectMode}
        selectedCategories={selectedCategories}
        addingTaskToTarget={addingTaskToTarget}
        scopeKey={location}
        getSmartTasks={getSmartTasks}
        getTasksForCategory={getTasksForCategory}
        getCategoryCompletionRate={getCategoryCompletionRate}
        itemLabelFor={itemLabelFor}
        setSelectedCategories={setSelectedCategories}
        setSelectedTaskId={setSelectedTaskId}
        setAddingTaskToTarget={setAddingTaskToTarget}
        setEditingCategory={setEditingCategory}
        deleteList={deleteList}
        handleAddTaskToCategory={handleAddTaskToCategoryCard}
        handleCompleteTask={taskActions.handleCompleteTask}
        handleTaskDragStart={drag.handleTaskDragStart}
      />
    )
  }

  return (
    <div className="fm98" style={{ height: "calc(100vh - 150px)", minHeight: 560 }}>
      <div className="fm-window">
        <div className="fm-title-bar">
          <div className="fm-title-bar-text">
            <img src={openIconKey} alt="" loading="lazy" decoding="async" />
            {openTarget ? `${openName} — Lists` : "Lists — File Manager"}
          </div>
          <div className="fm-title-bar-controls">
            <button className="fm-title-btn" aria-label="Minimize">_</button>
            <button className="fm-title-btn" aria-label="Maximize">□</button>
            <button className="fm-title-btn" aria-label="Close" onClick={closeTarget}>×</button>
          </div>
        </div>

        <div className="fm-window-body">
          <ListsToolbar
            openTarget={openTarget}
            isHome={isHome}
            isAll={isAll}
            searchTerm={searchTerm}
            searchActive={searchActive}
            selectMode={selectMode}
            folderView={folderView}
            currentDisplay={currentDisplay}
            location={location}
            entryKeys={entries.map((e) => `${e.kind}-${e.id}`)}
            enabledDisplays={offeredDisplays}
            onUp={() => { if (openTarget) closeTarget(); else navTo("all"); setActiveIconId(null) }}
            onNewList={openNewCategoryDialog}
            onNewFolder={() => setShowNewFolderDialog(true)}
            onImportCsv={() => csvRef.current?.click()}
            onCompleted={() => setShowCompletedTasks(true)}
            onSettings={() => setShowCategorySettings(true)}
            onToggleSelect={toggleSelectMode}
            onSearchChange={setSearchTerm}
            onClearSearch={() => setSearchTerm("")}
            onFolderViewChange={setFolderView}
            onListDisplayChange={setListDisplay}
            onAutoOrganize={handleAutoOrganize}
          />
          <input
            ref={csvRef}
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            hidden
            onChange={handleCsvFile}
          />

          <div className="fm-status-bar">
            <div className="fm-status-field shrink" style={{ minWidth: 60 }}>Address</div>
            <div className="fm-status-field">{breadcrumb}</div>
          </div>

          {itemSelectActive && (
            <ItemSelectionToolbar
              selectedCount={selectedTaskIds.length}
              placementMode={effectiveItemPlacement}
              canMove={itemCanMove}
              excludeListIds={excludedListIdsForSelection(categories, originListId)}
              onSelectAll={handleSelectAllItems}
              onDeselectAll={clearTaskSelection}
              onPlacementModeChange={setItemPlacementMode}
              onAddToNewList={openNewCategoryDialog}
              onAddToLists={placeItemsIntoLists}
              onMerge={() => setItemMergeConfirmOpen(true)}
              onDelete={handleDeleteSelectedItems}
            />
          )}
          {selectMode && !itemSelectActive && (
            <SelectionToolbar
              selectedListCount={selectedCategories.length}
              selectedFolderCount={selectedFolderIds.length}
              placementMode={effectivePlacement}
              originIsAll={isAll}
              destinationFolders={destinationFoldersForSelection(folders, {
                currentFolderId: currentFolder?.id,
                selectedFolderIds,
              })}
              onSelectAll={handleSelectAllVisible}
              onDeselectAll={clearSelection}
              onPlacementModeChange={setPlacementMode}
              onAddToNewFolder={() => setShowNewFolderDialog(true)}
              onAddToFolder={placeListsIntoFolder}
              onMerge={() => setMergeConfirmOpen(true)}
              onDelete={handleDeleteSelected}
            />
          )}

          <div className="fm-split">
            <FolderTree
              folders={folders}
              location={location}
              openTarget={openTarget}
              isHome={isHome}
              isAll={isAll}
              onNavTo={navTo}
              onDragOver={drag.handleDragOver}
              onDrop={drag.handleFolderTreeDrop}
              onCreateFolder={() => setShowNewFolderDialog(true)}
              onEditFolder={setEditingFolder}
            />

            <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
              {openTarget && (
                <div className="fm-title-bar inactive" style={{ marginBottom: 3 }}>
                  <div className="fm-title-bar-text">
                    {openColor && <span style={{ display: "inline-block", width: 12, height: 12, background: openColor }} />}
                    {openName}
                  </div>
                  <div className="fm-title-bar-controls">
                    {openTarget.type !== "habits" && openTarget.type !== "objectives" && (
                      <button className="fm-title-btn" title="Add task" onClick={() => setAddingTaskToTarget(openTargetKey(openTarget))}>+</button>
                    )}
                    {openCategory && (
                      <button className="fm-title-btn" title="List settings" onClick={() => setEditingCategory(openCategory)}>⚙</button>
                    )}
                    <button className="fm-title-btn" aria-label="Close" onClick={closeTarget}>×</button>
                  </div>
                </div>
              )}
              {renderMainContent()}
            </div>

            {openCategory && (
              <div className="fm-sidebar" style={{ width: 150 }}>
                <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                  <button className="fm-btn fm-btn-sm" onClick={() => setAddingTaskToTarget(openCategory.id)}>Add {itemLabelFor(openCategory.id, openCategory)}</button>
                  <button className="fm-btn fm-btn-sm" onClick={() => setShowBulkAdd(true)}>Bulk add</button>
                  <button className="fm-btn fm-btn-sm" onClick={() => setEditingCategory(openCategory)}>List Settings</button>
                  <button className="fm-btn fm-btn-sm" onClick={() => setIconPickerFor({ kind: "category", id: openCategory.id })}>Change Icon</button>
                  <button className="fm-btn fm-btn-sm" onClick={() => toggleHomePin(openCategory.id)}>{homePinned.includes(openCategory.id) ? "Unpin Home" : "Pin to Home"}</button>
                  <button className="fm-btn fm-btn-sm fm-btn-danger" onClick={() => { if (confirm(`Delete list "${openCategory.name}"?`)) { deleteList(openCategory.id); closeTarget() } }}>Delete List</button>
                </div>
              </div>
            )}
            {openFolderAll && currentFolder && !isRootAll && (
              <div className="fm-sidebar" style={{ width: 150 }}>
                <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                  <button className="fm-btn fm-btn-sm" onClick={() => setAddingTaskToTarget(openTargetKey(openTarget!))}>Add Item</button>
                  <button className="fm-btn fm-btn-sm" onClick={() => setShowBulkAdd(true)}>Bulk add</button>
                  <p style={{ fontSize: 10, color: "var(--fm-button-shadow)" }}>Items added here stay uncategorized until filed into a list.</p>
                </div>
              </div>
            )}
            {openSmart && (
              <div className="fm-sidebar" style={{ width: 150 }}>
                <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                  <button className="fm-btn fm-btn-sm" onClick={() => setAddingTaskToTarget(openSmart.id)}>Add Task</button>
                  <p style={{ fontSize: 10, color: "var(--fm-button-shadow)" }}>Synced with the dashboard To-Do panel.</p>
                </div>
              </div>
            )}
            {!openCategory && !openFolderAll && !openSmart && currentFolder && (
              <div className="fm-sidebar" style={{ width: 150 }}>
                <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                  {!isScheduledFolderId(currentFolder.id) || currentFolder.id === "na-scheduled" ? (
                    <button className="fm-btn fm-btn-sm" onClick={() => setEditingFolder(currentFolder)}>Folder Settings</button>
                  ) : null}
                  <button className="fm-btn fm-btn-sm" onClick={() => setIconPickerFor({ kind: "folder", id: currentFolder.id })}>Change Icon</button>
                  <button className="fm-btn fm-btn-sm" onClick={openNewCategoryDialog}>New List Here</button>
                  <button className="fm-btn fm-btn-sm" onClick={() => toggleHomePin(currentFolder.id)}>{homePinned.includes(currentFolder.id) ? "Unpin Home" : "Pin to Home"}</button>
                </div>
              </div>
            )}
          </div>

          <div className="fm-status-bar">
            <div className="fm-status-field">{statusText}</div>
            <div className="fm-status-field shrink" style={{ minWidth: 140 }}>{folders.length} folder(s), {categories.length} list(s)</div>
            <div className="fm-status-field shrink" style={{ minWidth: 90 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <input type="checkbox" checked={showSmartLists} onChange={(e) => setShowSmartLists(e.target.checked)} />
                Smart lists
              </label>
            </div>
          </div>
        </div>
      </div>

      <NewListDialog open={newCategoryOpen} currentFolder={currentFolder} isHome={isHome} name={newCategoryName} description={newCategoryDescription} color={newCategoryColor} scheduleable={newCategoryScheduleable} template={newCategoryTemplate} selectedCount={selectedTaskIds.length} placementMode={effectiveItemPlacement} canMove={itemCanMove} onPlacementModeChange={setItemPlacementMode} onOpenChange={setNewCategoryOpen} onNameChange={setNewCategoryName} onDescriptionChange={setNewCategoryDescription} onColorChange={setNewCategoryColor} onScheduleableChange={setNewCategoryScheduleable} onTemplateChange={setNewCategoryTemplate} onCreate={handleCreateCategory} />
      {csvImport && <CsvImportDialog csvImport={csvImport} categories={categories} onClose={() => setCsvImport(null)} onImport={performCsvImport} onUpdate={setCsvImport} />}
      <EditListDialog editingCategory={editingCategory} onEditingCategoryChange={setEditingCategory} folders={folders} homePinned={homePinned} listDisplay={listDisplay} setListDisplay={setListDisplay} toggleHomePin={toggleHomePin} onOpenIconPicker={() => editingCategory && setIconPickerFor({ kind: "category", id: editingCategory.id })} onSave={handleEditCategory} onDelete={() => { if (editingCategory && confirm(`Delete list "${editingCategory.name}"?`)) { deleteList(editingCategory.id); if (openTarget?.type === "category" && openTarget.id === editingCategory.id) closeTarget(); setEditingCategory(null) } }} />
      <EditFolderDialog editingFolder={editingFolder} onEditingFolderChange={setEditingFolder} homePinned={homePinned} toggleHomePin={toggleHomePin} onOpenIconPicker={() => editingFolder && setIconPickerFor({ kind: "folder", id: editingFolder.id })} onSave={() => { if (editingFolder) { updateFolder(editingFolder); setEditingFolder(null) } }} onDelete={() => { if (editingFolder && confirm("Delete this folder? The lists inside it will not be deleted.")) { deleteFolder(editingFolder.id); if (location === editingFolder.id) navTo("all"); setEditingFolder(null) } }} />
      <NewFolderDialog open={showNewFolderDialog} name={newFolderName} color={newFolderColor} scheduleable={newFolderScheduleable} selectedCount={selectedCategories.length + selectedFolderIds.length} placementMode={effectivePlacement} originIsAll={isAll} onPlacementModeChange={setPlacementMode} onOpenChange={setShowNewFolderDialog} onNameChange={setNewFolderName} onColorChange={setNewFolderColor} onScheduleableChange={setNewFolderScheduleable} onCreate={() => { if (newFolderName.trim()) { const id = Date.now().toString() + Math.random().toString(36).substr(2, 5); addFolder({ id, name: newFolderName, createdAt: new Date(), listIds: selectedCategories, color: newFolderColor, scheduleable: newFolderScheduleable, parentFolderId: currentFolder?.id }); const unlink = originFolderIdToUnlink({ mode: effectivePlacement, originFolderId: currentFolder?.id, isAll }); if (unlink) selectedCategories.forEach((catId) => removeListFromFolder(unlink, catId)); if (effectivePlacement === "move") selectedFolderIds.forEach((fid) => { if (wouldCreateFolderCycle(folders, fid, id)) return; const child = folders.find((f) => f.id === fid); if (child) updateFolder({ ...child, parentFolderId: id }) }); setShowNewFolderDialog(false); setNewFolderName(""); setNewFolderColor("#3B82F6"); setNewFolderScheduleable(true); selection.cancelSelectMode() } }} />
      <MergeListsConfirmDialog open={mergeConfirmOpen} listNames={selectedMergeLists.map((l) => l.name)} onCancel={() => setMergeConfirmOpen(false)} onContinue={() => { setMergeConfirmOpen(false); setMergeOpen(true) }} />
      <MergeListsDialog open={mergeOpen} lists={selectedMergeLists} folders={folders} tasks={allTasks} onClose={() => setMergeOpen(false)} onMerge={handleApplyMerge} />
      <MergeItemsConfirmDialog open={itemMergeConfirmOpen} itemNames={selectedMergeItems.map(itemMergeLabel)} onCancel={() => setItemMergeConfirmOpen(false)} onContinue={() => { setItemMergeConfirmOpen(false); setItemMergeOpen(true) }} />
      <MergeItemsDialog open={itemMergeOpen} items={selectedMergeItems} lists={categories} onClose={() => setItemMergeOpen(false)} onMerge={handleApplyItemMerge} />
      <NextActionsSettingsDialog open={showCategorySettings} onClose={() => setShowCategorySettings(false)} />
      <CompletedTasksDialog open={showCompletedTasks} onClose={() => setShowCompletedTasks(false)} onTaskSelect={setSelectedTaskId} />
      <TaskDetailPopup taskId={selectedTaskId} open={!!selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      <OrbPickerDialog open={!!iconPickerFor} current={iconPickerCurrent} onClose={() => setIconPickerFor(null)} onSelect={applyIcon} />
    </div>
  )
}
