/**
 * components/Lists/enhanced-category-view.tsx — Lists board orchestrator
 *
 * Composes hooks, views, dialogs, and navigation for the retro File Manager UI.
 * Spec: §6 (Next Actions / Lists).
 */
"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { useItemTypeStore } from "@/lib/item-type-store"
import { useListsUiStore, type ListDisplay } from "@/lib/lists-ui-store"
import { parseCsv, inferColumnType } from "@/lib/csv"
import {
  getWeekString,
  taskScheduledOnDay,
  taskScheduledInWeek,
  taskScheduledInMonth,
} from "@/lib/date-utils"
import {
  capitalizeLabel,
  getItemLabel,
  listIsNextActions,
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
} from "@/lib/folder-all-items"
import { buildGridEntries, ROOT_ALL_FOLDER_ID } from "@/lib/lists-grid-entries"
import { TaskDetailPopup } from "@/components/task-detail-popup"
import { NextActionsSettingsDialog } from "@/components/Lists/settings-dialog"
import { DailyHabitsList, WeeklyHabitsList, MonthlyHabitsList } from "@/components/Lists/daily-habits-list"
import { ObjectivesList } from "@/components/Lists/objectives-list"
import { useGoalsStore } from "@/lib/goals-store"
import { useListsNavigation } from "@/components/Lists/hooks/useListsNavigation"
import { useListsSearch } from "@/components/Lists/hooks/useListsSearch"
import { useListsDragDrop } from "@/components/Lists/hooks/useListsDragDrop"
import { useListsSelection } from "@/components/Lists/hooks/useListsSelection"
import { useListsTaskActions } from "@/components/Lists/hooks/useListsTaskActions"
import { FolderTree } from "@/components/Lists/navigation/FolderTree"
import { getBreadcrumb } from "@/components/Lists/navigation/BreadcrumbNav"
import { ListsToolbar } from "@/components/Lists/toolbar/ListsToolbar"
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
import { EditListDialog } from "@/components/Lists/dialogs/EditListDialog"
import { EditFolderDialog } from "@/components/Lists/dialogs/EditFolderDialog"
import { LIST_TEMPLATES, SMART_LISTS, PRESET_ICON_POSITIONS } from "@/components/Lists/constants"
import { iconFor, orbFor } from "@/components/Lists/lib/icon-utils"
import { openTargetKey } from "@/components/Lists/open-target"
import type { CsvImportState, IconPickerTarget, SmartId } from "@/components/Lists/types"
import type { List, Folder, AttributeValue } from "@/lib/types"
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
  const updateTask = useTaskStore((s) => s.updateTask)
  const addTask = useTaskStore((s) => s.addTask)
  const dedupeFolders = useTaskStore((s) => s.dedupeFolders)
  const dedupeLists = useTaskStore((s) => s.dedupeLists)
  const itemTypes = useItemTypeStore((s) => s.types)
  const objectiveCount = useGoalsStore((s) => s.objectives.filter((o) => !o.archived).length)

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

  const nav = useListsNavigation(categories, folders)
  const search = useListsSearch(folders, categories, allTasks)
  const drag = useListsDragDrop({ folders, lists: categories, types: itemTypes, updateTask, addListToFolder, removeListFromFolder })
  const selection = useListsSelection()
  const taskActions = useListsTaskActions(allTasks, categories, folders, addTask, updateTask, itemTypes)

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
  const [bulkAddText, setBulkAddText] = useState("")
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
  const { selectMode, selectedCategories, setSelectedCategories, toggleSelectMode } = selection

  useEffect(() => {
    dedupeFolders()
    dedupeLists()
  }, [dedupeFolders, dedupeLists])

  useEffect(() => {
    const state = useTaskStore.getState()
    const mut = {
      lists: state.lists,
      folders: state.folders,
      addList: state.addList,
      updateList: state.updateList,
      addFolder: state.addFolder,
      updateFolder: state.updateFolder,
    }
    syncNextActionsSmartLists(mut)
    syncScheduledFolderHierarchy(allTasks, mut)
    syncFolderAllItemsCategories(mut)
  }, [allTasks])

  const getSmartTasks = useCallback(
    (id: SmartId) => {
      const now = new Date()
      return allTasks.filter((t) => {
        if (t.completed) return false
        if (id === "daily") return taskScheduledOnDay(t, now)
        if (id === "weekly") return taskScheduledInWeek(t, getWeekString(now))
        return taskScheduledInMonth(t, now.toISOString().slice(0, 7))
      })
    },
    [allTasks],
  )

  const getTasksForCategory = useCallback(
    (categoryId: string) => allTasks.filter((t) => t.lists?.includes(categoryId) && !t.completed),
    [allTasks],
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
    (categoryId: string) => {
      const categoryTasks = allTasks.filter((t) => t.lists?.includes(categoryId))
      if (categoryTasks.length === 0) return 0
      return Math.round((categoryTasks.filter((t) => t.completed).length / categoryTasks.length) * 100)
    },
    [allTasks],
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

  const openTasks = useMemo(() => {
    if (!openTarget) return []
    if (openTarget.type === "category") {
      if (isNaSmartCategoryId(openTarget.id)) {
        const p = naSmartIdToPeriod(openTarget.id)
        return p ? getSmartTasks(p) : []
      }
      return getTasksForCategory(openTarget.id)
    }
    if (openTarget.type === "folder-all" && openTarget.folderId === ROOT_ALL_FOLDER_ID) return allTasks.filter((t) => !t.completed)
    if (openTarget.type === "folder-all" && currentFolder) {
      if (isScheduledFolderId(currentFolder.id)) return getTasksForScheduledFolder(allTasks, currentFolder.id)
      let items = getTasksForFolderAllView(allTasks, currentFolder)
      if (folderAllUncategorizedOnly[currentFolder.id]) items = items.filter((t) => isTaskUncategorizedInFolder(t, currentFolder))
      return items
    }
    if (openTarget.type === "smart") return getSmartTasks(openTarget.id)
    return []
  }, [openTarget, allTasks, currentFolder, folderAllUncategorizedOnly, getSmartTasks, getTasksForCategory])

  const rawDisplay: ListDisplay =
    openTarget && openTarget.type !== "habits" && openTarget.type !== "objectives"
      ? listDisplay[openTargetKey(openTarget)] || (openSmart ? "checklist" : openFolderAll ? "table" : "default")
      : "default"
  // If the list no longer offers the saved active display, fall back to the
  // first display it does offer (Feature 1: per-list display offerings).
  const offeredDisplays = openCategory?.enabledDisplays
  const currentDisplay: ListDisplay =
    offeredDisplays && offeredDisplays.length > 0 && !offeredDisplays.includes(rawDisplay)
      ? offeredDisplays[0]
      : rawDisplay

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
    setNewCategoryOpen(false)
    setNewCategoryName("")
    setNewCategoryDescription("")
    setNewCategoryColor("#3B82F6")
    setNewCategoryScheduleable(true)
    setNewCategoryTemplate("none")
  }, [newCategoryName, newCategoryColor, newCategoryDescription, newCategoryScheduleable, newCategoryTemplate, addList, categories.length, currentFolder, addListToFolder, isHome, toggleHomePin])

  const handleEditCategory = useCallback(() => {
    if (editingCategory) {
      updateList(editingCategory)
      setEditingCategory(null)
    }
  }, [editingCategory, updateList])

  const handleCsvFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const { headers, rows } = parseCsv(String(reader.result || ""))
      if (headers.length === 0) return
      const lower = headers.map((h) => h.toLowerCase())
      const nameCandidates = ["name", "title", "item", "task", "description", "book", "product"]
      let nameCol = lower.findIndex((h) => nameCandidates.some((c) => h.includes(c)))
      if (nameCol === -1) nameCol = 0
      setCsvImport({ fileName: file.name, headers, rows, listName: file.name.replace(/\.csv$/i, ""), nameCol, targetCategoryId: "" })
    }
    reader.readAsText(file)
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
      addList({ id: categoryId, name: listName || "Imported list", color: newCategoryColor, description: `Imported from ${csvImport.fileName}`, createdAt: new Date(), order: categories.length, scheduleable: true, itemAttributes: attrDefs })
      if (currentFolder) addListToFolder(currentFolder.id, categoryId)
      if (isHome) toggleHomePin(categoryId)
    } else {
      const existing = categories.find((c) => c.id === categoryId)
      if (existing) {
        const merged = [...(existing.itemAttributes || [])]
        attrDefs.forEach((d) => { if (!merged.some((m) => m.id === d.id)) merged.push(d) })
        updateList({ ...existing, itemAttributes: merged })
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
    setCsvImport(null)
  }, [csvImport, addList, addTask, updateList, categories, newCategoryColor, currentFolder, addListToFolder, isHome, toggleHomePin, taskActions])

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
          itemLabel={openFolderAll && currentFolder && !isRootAll ? "Item" : itemLabelFor(openCategory?.id, openCategory)}
          openIconKey={openIconKey}
          folderAllUncategorizedOnly={folderAllUncategorizedOnly}
          onFolderAllUncategorizedOnlyChange={setFolderAllUncategorizedOnly}
          addingTaskToTarget={addingTaskToTarget}
          openTargetKeyValue={openTargetKey(openTarget)}
          newTaskDescription={newTaskDescription}
          onNewTaskDescriptionChange={setNewTaskDescription}
          onAddTask={() => taskActions.handleAddTaskToOpen(newTaskDescription, openTarget, currentFolder, () => { setNewTaskDescription(""); setAddingTaskToTarget(null) })}
          onCancelAddTask={() => setAddingTaskToTarget(null)}
          showBulkAdd={showBulkAdd}
          bulkAddText={bulkAddText}
          onBulkAddTextChange={setBulkAddText}
          onBulkAdd={() => taskActions.handleBulkAddToOpen(bulkAddText, openTarget, currentFolder, () => { setBulkAddText(""); setShowBulkAdd(false) })}
          onShowBulkAdd={setShowBulkAdd}
          onBulkAddCancel={() => { setShowBulkAdd(false); setBulkAddText("") }}
          onTaskSelect={setSelectedTaskId}
          onCompleteTask={taskActions.handleCompleteTask}
          onTaskDragStart={drag.handleTaskDragStart}
          onDragEnd={drag.clearDrag}
          onIconPickerOpen={(taskId) => setIconPickerFor({ kind: "task", id: taskId })}
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
    if (folderView === "list") return <FolderViewList {...folderViewCommon} />
    if (folderView === "details") return <FolderViewDetails {...folderViewCommon} getCategoryCompletionRate={getCategoryCompletionRate} />
    return (
      <FolderViewCards
        {...folderViewCommon}
        categories={categories}
        selectMode={selectMode}
        selectedCategories={selectedCategories}
        addingTaskToTarget={addingTaskToTarget}
        newTaskDescription={newTaskDescription}
        getSmartTasks={getSmartTasks}
        getTasksForCategory={getTasksForCategory}
        getCategoryCompletionRate={getCategoryCompletionRate}
        itemLabelFor={itemLabelFor}
        setSelectedCategories={setSelectedCategories}
        setSelectedTaskId={setSelectedTaskId}
        setAddingTaskToTarget={setAddingTaskToTarget}
        setEditingCategory={setEditingCategory}
        deleteList={deleteList}
        setNewTaskDescription={setNewTaskDescription}
        handleAddTaskToCategory={(id) => taskActions.handleAddTaskToCategory(id, newTaskDescription, () => { setNewTaskDescription(""); setAddingTaskToTarget(null) })}
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
            <img src={openIconKey} alt="" />
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
            enabledDisplays={openCategory?.enabledDisplays}
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
          <input ref={csvRef} type="file" accept=".csv,text/csv" hidden onChange={handleCsvFile} />

          <div className="fm-status-bar">
            <div className="fm-status-field shrink" style={{ minWidth: 60 }}>Address</div>
            <div className="fm-status-field">{breadcrumb}</div>
          </div>

          {selectMode && (
            <div className="fm-toolbar" style={{ marginTop: 3 }}>
              <span style={{ fontSize: 11 }}>{selectedCategories.length} selected</span>
              <button className="fm-btn fm-btn-sm" onClick={() => setShowNewFolderDialog(true)} disabled={selectedCategories.length === 0}>Add to New Folder</button>
              {folders.map((folder) => (
                <button key={folder.id} className="fm-btn fm-btn-sm" disabled={selectedCategories.length === 0} onClick={() => { selectedCategories.forEach((catId) => addListToFolder(folder.id, catId)); selection.cancelSelectMode() }}>
                  → {folder.name}
                </button>
              ))}
            </div>
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
                  <button className="fm-btn fm-btn-sm" onClick={() => setEditingFolder(currentFolder)}>Folder Settings</button>
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

      <NewListDialog open={newCategoryOpen} currentFolder={currentFolder} isHome={isHome} name={newCategoryName} description={newCategoryDescription} color={newCategoryColor} scheduleable={newCategoryScheduleable} template={newCategoryTemplate} onOpenChange={setNewCategoryOpen} onNameChange={setNewCategoryName} onDescriptionChange={setNewCategoryDescription} onColorChange={setNewCategoryColor} onScheduleableChange={setNewCategoryScheduleable} onTemplateChange={setNewCategoryTemplate} onCreate={handleCreateCategory} />
      {csvImport && <CsvImportDialog csvImport={csvImport} categories={categories} onClose={() => setCsvImport(null)} onImport={performCsvImport} onUpdate={setCsvImport} />}
      <EditListDialog editingCategory={editingCategory} onEditingCategoryChange={setEditingCategory} folders={folders} homePinned={homePinned} listDisplay={listDisplay} setListDisplay={setListDisplay} toggleHomePin={toggleHomePin} onOpenIconPicker={() => editingCategory && setIconPickerFor({ kind: "category", id: editingCategory.id })} onSave={handleEditCategory} onDelete={() => { if (editingCategory && confirm(`Delete list "${editingCategory.name}"?`)) { deleteList(editingCategory.id); if (openTarget?.type === "category" && openTarget.id === editingCategory.id) closeTarget(); setEditingCategory(null) } }} />
      <EditFolderDialog editingFolder={editingFolder} onEditingFolderChange={setEditingFolder} homePinned={homePinned} toggleHomePin={toggleHomePin} onOpenIconPicker={() => editingFolder && setIconPickerFor({ kind: "folder", id: editingFolder.id })} onSave={() => { if (editingFolder) { updateFolder(editingFolder); setEditingFolder(null) } }} onDelete={() => { if (editingFolder && confirm("Delete this folder? The lists inside it will not be deleted.")) { deleteFolder(editingFolder.id); if (location === editingFolder.id) navTo("all"); setEditingFolder(null) } }} />
      <NewFolderDialog open={showNewFolderDialog} name={newFolderName} color={newFolderColor} scheduleable={newFolderScheduleable} selectedCount={selectedCategories.length} onOpenChange={setShowNewFolderDialog} onNameChange={setNewFolderName} onColorChange={setNewFolderColor} onScheduleableChange={setNewFolderScheduleable} onCreate={() => { if (newFolderName.trim()) { addFolder({ id: Date.now().toString() + Math.random().toString(36).substr(2, 5), name: newFolderName, createdAt: new Date(), listIds: selectedCategories, color: newFolderColor, scheduleable: newFolderScheduleable }); setShowNewFolderDialog(false); setNewFolderName(""); setNewFolderColor("#3B82F6"); setNewFolderScheduleable(true); selection.cancelSelectMode() } }} />
      <NextActionsSettingsDialog open={showCategorySettings} onClose={() => setShowCategorySettings(false)} />
      <CompletedTasksDialog open={showCompletedTasks} onClose={() => setShowCompletedTasks(false)} onTaskSelect={setSelectedTaskId} />
      <TaskDetailPopup taskId={selectedTaskId} open={!!selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      <OrbPickerDialog open={!!iconPickerFor} current={iconPickerCurrent} onClose={() => setIconPickerFor(null)} onSelect={applyIcon} />
    </div>
  )
}
