"use client"

/**
 * components/Lists/board/lists-main-pane.tsx
 *
 * The main pane, in one branch order: search, habits, objectives, an open
 * list, then folder icons, list, details, and cards. The task list is passed
 * in. This component is not memoized.
 */
import { useCallback } from "react"
import type { Dispatch, SetStateAction } from "react"
import type { ListDisplay } from "@/lib/lists-ui-store"
import { isNaPeriodSmartCategoryId } from "@/lib/scheduled-lists-sync"
import { documentAttrsFromFile, photoAttrsFromFile, titleFromFileName } from "@/lib/media-ingest"
import { listAllowsDocuments } from "@/lib/document-types"
import { listAllowsPhotos } from "@/lib/photo-types"
import type { Folder, ItemTypeDefinition, List, ListItemSort, Task } from "@/lib/types"
import type { ListItemSortOption } from "@/lib/list-item-sort"
import { DailyHabitsList, WeeklyHabitsList, MonthlyHabitsList, SeasonHabitsList } from "@/components/Lists/daily-habits-list"
import { ObjectivesList } from "@/components/Lists/objectives-list"
import { useListsDragDrop } from "@/components/Lists/hooks/useListsDragDrop"
import { useListsTaskActions } from "@/components/Lists/hooks/useListsTaskActions"
import { FolderViewIcons } from "@/components/Lists/views/FolderViewIcons"
import { FolderViewList } from "@/components/Lists/views/FolderViewList"
import { FolderViewDetails } from "@/components/Lists/views/FolderViewDetails"
import { FolderViewCards } from "@/components/Lists/views/FolderViewCards"
import { SearchResultsView } from "@/components/Lists/views/SearchResultsView"
import { ListContentPanel } from "@/components/Lists/list-content/ListContentPanel"
import { openTargetKey } from "@/components/Lists/open-target"
import type { GridEntry, IconPickerTarget, OpenTarget, SmartId } from "@/components/Lists/types"

type DragApi = ReturnType<typeof useListsDragDrop>
type TaskActionsApi = ReturnType<typeof useListsTaskActions>

export function ListsMainPane({
  searchActive,
  searchTerm,
  searchResults,
  getTasksForCategory,
  handleNavTo,
  folders,
  setLocation,
  setOpenTarget,
  clearSearch,
  setSelectedTaskId,
  selectMode,
  selectedFolderIds,
  selectedCategories,
  selectedTaskIds,
  toggleFolderSelection,
  toggleCategorySelection,
  toggleTaskSelection,
  openTarget,
  shownTasks,
  currentSort,
  sortOptions,
  handleSortChange,
  listSearchQuery,
  openCategory,
  showSentItems,
  setShowSentItems,
  currentDisplay,
  categories,
  viewList,
  openFolderAll,
  openSmart,
  currentFolder,
  isRootAll,
  openTypeList,
  itemLabelFor,
  openIconKey,
  folderAllUncategorizedOnly,
  setFolderAllUncategorizedOnly,
  folderAllHiddenListIds,
  folderAllHideUncategorized,
  globalAllHiddenFolderIds,
  globalAllUncategorizedOnly,
  setGlobalAllUncategorizedOnly,
  globalAllHideUncategorized,
  addingTaskToTarget,
  setAddingTaskToTarget,
  taskActions,
  addTask,
  showBulkAdd,
  setShowBulkAdd,
  drag,
  setIconPickerFor,
  listIconsDesktopOn,
  listDesktopOrganizeEpoch,
  listPileEpoch,
  listGravityResetEpoch,
  listGravitySettleEpoch,
  folderView,
  location,
  entries,
  activeIconId,
  setActiveIconId,
  handleOpenEntry,
  isHome,
  homePinned,
  iconPositions,
  iconLayoutMode,
  organizeEpoch,
  organizeFromSnapshot,
  setOrganizeFromSnapshot,
  setIconPosition,
  commitIconLayout,
  setSelectedCategories,
  toggleHomePin,
  openNewCategoryDialog,
  handleCanvasWidth,
  folderRenameProps,
  getCategoryCompletionRate,
  categoryById,
  getSmartTasks,
  deleteList,
  setEditingCategory,
}: {
  searchActive: boolean
  searchTerm: string
  searchResults: { folders: Folder[]; lists: List[]; tasks: Task[] }
  getTasksForCategory: (categoryId: string) => Task[]
  handleNavTo: (loc: string) => void
  folders: Folder[]
  setLocation: (loc: string) => void
  setOpenTarget: (target: OpenTarget) => void
  clearSearch: () => void
  setSelectedTaskId: Dispatch<SetStateAction<string | null>>
  selectMode: boolean
  selectedFolderIds: string[]
  selectedCategories: string[]
  selectedTaskIds: string[]
  toggleFolderSelection: (folderId: string) => void
  toggleCategorySelection: (categoryId: string) => void
  toggleTaskSelection: (taskId: string) => void
  openTarget: OpenTarget
  shownTasks: Task[]
  currentSort: ListItemSort | undefined
  sortOptions: ListItemSortOption[]
  handleSortChange: (sort: ListItemSort | undefined) => void
  listSearchQuery: string
  openCategory: List | null
  showSentItems: boolean
  setShowSentItems: (show: boolean) => void
  currentDisplay: ListDisplay
  categories: List[]
  viewList: List | null
  openFolderAll: boolean
  openSmart: { id: string } | null
  currentFolder: Folder | null
  isRootAll: boolean
  openTypeList: ItemTypeDefinition | null
  itemLabelFor: (categoryId?: string, category?: List | null) => string
  openIconKey: string
  folderAllUncategorizedOnly: Record<string, boolean>
  setFolderAllUncategorizedOnly: (folderId: string, value: boolean) => void
  folderAllHiddenListIds: Record<string, string[]> | undefined
  folderAllHideUncategorized: Record<string, boolean> | undefined
  globalAllHiddenFolderIds: string[] | undefined
  globalAllUncategorizedOnly: boolean
  setGlobalAllUncategorizedOnly: (value: boolean) => void
  globalAllHideUncategorized: boolean
  addingTaskToTarget: string | null
  setAddingTaskToTarget: Dispatch<SetStateAction<string | null>>
  taskActions: TaskActionsApi
  addTask: (task: Task, attribution?: { surface: "list"; name?: string }) => void
  showBulkAdd: boolean
  setShowBulkAdd: Dispatch<SetStateAction<boolean>>
  drag: DragApi
  setIconPickerFor: (target: IconPickerTarget) => void
  listIconsDesktopOn: boolean
  listDesktopOrganizeEpoch: number
  listPileEpoch: number
  listGravityResetEpoch: number
  listGravitySettleEpoch: number
  folderView: string
  location: string
  entries: GridEntry[]
  activeIconId: string | null
  setActiveIconId: (id: string | null) => void
  handleOpenEntry: (entry: GridEntry) => void
  isHome: boolean
  homePinned: string[]
  iconPositions: Record<string, { x: number; y: number }>
  iconLayoutMode: Record<string, "auto" | "freeform">
  organizeEpoch: number
  organizeFromSnapshot: Record<string, { x: number; y: number }> | null
  setOrganizeFromSnapshot: (snap: Record<string, { x: number; y: number }> | null) => void
  setIconPosition: (location: string, entryId: string, x: number, y: number) => void
  commitIconLayout: (location: string, positions: Record<string, { x: number; y: number }>, mode: "auto" | "freeform") => void
  setSelectedCategories: Dispatch<SetStateAction<string[]>>
  toggleHomePin: (id: string) => void
  openNewCategoryDialog: () => void
  handleCanvasWidth: (width: number) => void
  folderRenameProps: {
    onFolderContextMenu: (folderId: string, clientX: number, clientY: number) => void
    renamingFolderId: string | null
    onCommitFolderRename: (folderId: string, name: string) => void
    onCancelFolderRename: () => void
  }
  getCategoryCompletionRate: (categoryId: string) => number
  categoryById: Map<string, List>
  getSmartTasks: (id: SmartId) => Task[]
  deleteList: (id: string) => void
  setEditingCategory: (list: List | null) => void
}) {
  const handleAddTaskToCategoryCard = useCallback(
    (categoryId: string, description: string) => {
      taskActions.handleAddTaskToCategory(categoryId, description, () => setAddingTaskToTarget(null))
    },
    [taskActions.handleAddTaskToCategory, setAddingTaskToTarget],
  )

  const folderViewCommon = {
    entries,
    activeIconId,
    setActiveIconId,
    openEntry: handleOpenEntry,
    handleCategoryDragStart: drag.handleCategoryDragStart,
    handleDragOver: drag.handleDragOver,
    handleDropOnEntry: drag.handleDropOnEntry,
    clearDrag: drag.clearDrag,
  }

  if (searchActive) {
    return (
      <SearchResultsView
        searchTerm={searchTerm}
        folders={searchResults.folders}
        lists={searchResults.lists}
        tasks={searchResults.tasks}
        getTasksForCategory={getTasksForCategory}
        onSelectFolder={handleNavTo}
        onSelectList={(listId, parentId) => {
          const parent = parentId || folders.find((f) => f.listIds.includes(listId))?.id || null
          setLocation(parent || "all")
          setOpenTarget({ type: "category", id: listId })
          clearSearch()
        }}
        onSelectTask={setSelectedTaskId}
        selectMode={selectMode}
        selectedFolderIds={selectedFolderIds}
        selectedListIds={selectedCategories}
        selectedTaskIds={selectedTaskIds}
        onToggleFolderSelect={toggleFolderSelection}
        onToggleListSelect={toggleCategorySelection}
        onToggleTaskSelect={toggleTaskSelection}
      />
    )
  }
  if (openTarget?.type === "habits") {
    if (openTarget.id === "weekly-habits") return <WeeklyHabitsList />
    if (openTarget.id === "monthly-habits") return <MonthlyHabitsList />
    if (openTarget.id === "season-habits") return <SeasonHabitsList />
    return <DailyHabitsList />
  }
  if (openTarget?.type === "objectives") return <ObjectivesList />
  if (openTarget) {
    return (
      <ListContentPanel
        tasks={shownTasks}
        sort={currentSort}
        sortOptions={sortOptions}
        onSortChange={handleSortChange}
        searchQuery={listSearchQuery}
        sentThisWeek={openTarget?.type === "category" && openCategory?.sentThisWeek === true}
        showSent={showSentItems}
        onShowSentChange={setShowSentItems}
        currentDisplay={currentDisplay}
        categories={categories}
        folders={folders}
        openCategory={viewList}
        openFolderAll={!!openFolderAll}
        openSmart={!!openSmart}
        currentFolder={currentFolder}
        isRootAll={isRootAll}
        itemLabel={
          openTypeList
            ? openTypeList.itemLabel || openTypeList.name
            : openFolderAll
              ? "Item"
              : itemLabelFor(openCategory?.id, openCategory)
        }
        openIconKey={openIconKey}
        folderAllUncategorizedOnly={folderAllUncategorizedOnly}
        onFolderAllUncategorizedOnlyChange={setFolderAllUncategorizedOnly}
        folderAllHiddenListIds={folderAllHiddenListIds ?? {}}
        folderAllHideUncategorized={folderAllHideUncategorized ?? {}}
        globalAllHiddenFolderIds={globalAllHiddenFolderIds ?? []}
        globalAllUncategorizedOnly={!!globalAllUncategorizedOnly}
        onGlobalAllUncategorizedOnlyChange={setGlobalAllUncategorizedOnly}
        globalAllHideUncategorized={!!globalAllHideUncategorized}
        addingTaskToTarget={addingTaskToTarget}
        openTargetKeyValue={openTargetKey(openTarget)}
        onAddMedia={
          openTarget?.type === "category" && (listAllowsPhotos(openCategory) || listAllowsDocuments(openCategory))
            ? async (drafts) => {
                const listId = openTarget.id
                const photo = listAllowsPhotos(openCategory)
                for (const d of drafts) {
                  const title = d.title?.trim() || (d.file ? titleFromFileName(d.file.name) : "")
                  if (!title) continue
                  const base = taskActions.buildBaseTask(title, listId)
                  base.lists = [listId]
                  const attrs = d.file ? await (photo ? photoAttrsFromFile(d.file) : documentAttrsFromFile(d.file)) : {}
                  addTask(
                    { ...base, attributes: { ...base.attributes, ...attrs } },
                    openCategory?.name?.trim() ? { surface: "list", name: openCategory.name.trim() } : { surface: "list" },
                  )
                }
              }
            : undefined
        }
        onAddTask={(text) => taskActions.handleAddTaskToOpen(text, openTarget, currentFolder, () => { setAddingTaskToTarget(null) })}
        onCancelAddTask={() => setAddingTaskToTarget(null)}
        onShowAddTask={() => { setShowBulkAdd(false); setAddingTaskToTarget(openTargetKey(openTarget)) }}
        showBulkAdd={showBulkAdd}
        onBulkAdd={(text) => taskActions.handleBulkAddToOpen(text, openTarget, currentFolder, () => { setShowBulkAdd(false) })}
        onShowBulkAdd={setShowBulkAdd}
        onBulkAddCancel={() => { setShowBulkAdd(false) }}
        onTaskSelect={setSelectedTaskId}
        onCompleteTask={taskActions.handleCompleteTask}
        onMissedOpportunity={taskActions.handleMissedOpportunity}
        allowAdd={!(openTarget?.type === "category" && isNaPeriodSmartCategoryId(openTarget.id))}
        onTaskDragStart={drag.handleTaskDragStart}
        onDragEnd={drag.clearDrag}
        onIconPickerOpen={(taskId) => setIconPickerFor({ kind: "task", id: taskId })}
        selectMode={selectMode}
        selectedTaskIds={selectedTaskIds}
        onToggleTaskSelect={toggleTaskSelection}
        iconsDesktop={listIconsDesktopOn}
        listOrganizeEpoch={listDesktopOrganizeEpoch}
        listPileEpoch={listPileEpoch}
        listGravityResetEpoch={listGravityResetEpoch}
        listGravitySettleEpoch={listGravitySettleEpoch}
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
        openEntry={handleOpenEntry}
        isHome={isHome}
        selectMode={selectMode}
        selectedCategories={selectedCategories}
        dropTargetId={drag.dropTargetId}
        homePinned={homePinned}
        iconPositions={iconPositions}
        iconLayoutMode={iconLayoutMode[location]}
        organizeEpoch={organizeEpoch}
        organizeFromSnapshot={organizeFromSnapshot}
        onOrganizeAnimationEnd={() => setOrganizeFromSnapshot(null)}
        setIconPosition={setIconPosition}
        commitIconLayout={commitIconLayout}
        onFileCategoryOnEntry={(categoryId, target) => {
          if (target.kind === "folder") drag.fileCategoryIntoFolder(categoryId, target.id)
          else if (target.kind === "folder-all") drag.fileCategoryIntoFolder(categoryId, null)
        }}
        setSelectedCategories={setSelectedCategories}
        setDropTargetId={drag.setDropTargetId}
        toggleHomePin={toggleHomePin}
        setIconPickerFor={setIconPickerFor}
        openNewCategoryDialog={openNewCategoryDialog}
        onCanvasWidth={handleCanvasWidth}
        {...folderRenameProps}
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
        {...folderRenameProps}
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
      handleMissedOpportunity={taskActions.handleMissedOpportunity}
      handleTaskDragStart={drag.handleTaskDragStart}
    />
  )
}
