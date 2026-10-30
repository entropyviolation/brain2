/**
 * components/Lists/enhanced-list-view.tsx — Lists board orchestrator
 *
 * Composes hooks, views, dialogs, and navigation for the retro File Manager UI.
 * Spec: §6 (Next Actions / Lists). Store subscriptions stay here. The window
 * shell, the Lists Names stamp, and the stylesheet import stay here too.
 */
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { useItemTypeStore } from "@/lib/item-type-store"
import { useListsUiStore } from "@/lib/lists-ui-store"
import { isScheduledFolderId } from "@/lib/scheduled-lists-sync"
import {
  folderAllItemsList,
  buildFolderAllItemsList,
  buildGlobalAllItemsList,
  GLOBAL_ALL_ITEMS_KEY,
} from "@/lib/folder-all-items"
import { useGoalsStore } from "@/lib/goals-store"
import { useModulesStore } from "@/lib/modules-store"
import { useListsNavigation } from "@/components/Lists/hooks/useListsNavigation"
import { useListsSearch } from "@/components/Lists/hooks/useListsSearch"
import { useListsDragDrop } from "@/components/Lists/hooks/useListsDragDrop"
import { useListsSelection } from "@/components/Lists/hooks/useListsSelection"
import { useListsTaskActions } from "@/components/Lists/hooks/useListsTaskActions"
import { useListsShelfMaintenance } from "@/components/Lists/hooks/useListsShelfMaintenance"
import { useListsShelf } from "@/components/Lists/hooks/useListsShelf"
import { useOpenListItems } from "@/components/Lists/hooks/useOpenListItems"
import { useListsClipboard } from "@/components/Lists/hooks/useListsClipboard"
import { useListsCreate } from "@/components/Lists/hooks/useListsCreate"
import { useListsDuplicate } from "@/components/Lists/hooks/useListsDuplicate"
import { useFolderContextMenu } from "@/components/Lists/hooks/useFolderContextMenu"
import { useListsCsvImport } from "@/components/Lists/hooks/useListsCsvImport"
import { useListsSelectionActions } from "@/components/Lists/hooks/useListsSelectionActions"
import { useListsIconChrome } from "@/components/Lists/hooks/useListsIconChrome"
import { FolderTree } from "@/components/Lists/navigation/FolderTree"
import { getBreadcrumb } from "@/components/Lists/navigation/BreadcrumbNav"
import { ListsToolbar } from "@/components/Lists/toolbar/ListsToolbar"
import { resolveOpenListChrome } from "@/components/Lists/lib/open-list-chrome"
import { chooseListsLocation } from "@/components/Lists/lib/lists-location-choice"
import { usePhoneListsLayout } from "@/components/Lists/board/use-phone-lists-layout"
import { ListsTitleBar } from "@/components/Lists/board/lists-title-bar"
import { ListsAddressBar } from "@/components/Lists/board/lists-address-bar"
import { ListsStatusBar } from "@/components/Lists/board/lists-status-bar"
import { ListsSelectStrip } from "@/components/Lists/board/lists-select-strip"
import { ListInnerCaption } from "@/components/Lists/board/list-inner-caption"
import { ListsInspector } from "@/components/Lists/board/lists-inspector"
import { ListsMainPane } from "@/components/Lists/board/lists-main-pane"
import { ListsDialogHost } from "@/components/Lists/board/lists-dialog-host"
import type { GridEntry } from "@/components/Lists/types"
import type { List, Folder } from "@/lib/types"
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
  const showPeriodLedgerListsInAll = useListsUiStore((s) => s.showPeriodLedgerListsInAll)
  const setShowPeriodLedgerListsInAll = useListsUiStore((s) => s.setShowPeriodLedgerListsInAll)
  const listDisplay = useListsUiStore((s) => s.listDisplay)
  const setListDisplay = useListsUiStore((s) => s.setListDisplay)
  const folderView = useListsUiStore((s) => s.folderView)
  const setFolderView = useListsUiStore((s) => s.setFolderView)
  const setIconPosition = useListsUiStore((s) => s.setIconPosition)
  const commitIconLayout = useListsUiStore((s) => s.commitIconLayout)
  const iconPositions = useListsUiStore((s) => s.iconPositions)
  const iconLayoutMode = useListsUiStore((s) => s.iconLayoutMode)
  const listIconsDesktop = useListsUiStore((s) => s.listIconsDesktop)
  const listIconsGravity = useListsUiStore((s) => s.listIconsGravity)
  const setListIconsGravity = useListsUiStore((s) => s.setListIconsGravity)
  const folderAllUncategorizedOnly = useListsUiStore((s) => s.folderAllUncategorizedOnly)
  const setFolderAllUncategorizedOnly = useListsUiStore((s) => s.setFolderAllUncategorizedOnly)
  const folderAllHideUncategorized = useListsUiStore((s) => s.folderAllHideUncategorized)
  const setFolderAllHideUncategorized = useListsUiStore((s) => s.setFolderAllHideUncategorized)
  const folderAllHiddenListIds = useListsUiStore((s) => s.folderAllHiddenListIds)
  const setFolderAllListHidden = useListsUiStore((s) => s.setFolderAllListHidden)
  const setFolderAllHiddenListIds = useListsUiStore((s) => s.setFolderAllHiddenListIds)
  const globalAllHiddenFolderIds = useListsUiStore((s) => s.globalAllHiddenFolderIds)
  const setGlobalAllFolderHidden = useListsUiStore((s) => s.setGlobalAllFolderHidden)
  const setGlobalAllHiddenFolderIds = useListsUiStore((s) => s.setGlobalAllHiddenFolderIds)
  const globalAllUncategorizedOnly = useListsUiStore((s) => s.globalAllUncategorizedOnly)
  const setGlobalAllUncategorizedOnly = useListsUiStore((s) => s.setGlobalAllUncategorizedOnly)
  const globalAllHideUncategorized = useListsUiStore((s) => s.globalAllHideUncategorized)
  const setGlobalAllHideUncategorized = useListsUiStore((s) => s.setGlobalAllHideUncategorized)
  const hiddenItemTypeIdsByTarget = useListsUiStore((s) => s.hiddenItemTypeIdsByTarget)
  const setItemTypeHidden = useListsUiStore((s) => s.setItemTypeHidden)
  const setHiddenItemTypeIds = useListsUiStore((s) => s.setHiddenItemTypeIds)

  const nav = useListsNavigation(categories, folders)
  const search = useListsSearch(folders, categories, allTasks)
  const drag = useListsDragDrop({ folders, lists: categories, types: itemTypes, updateTask, addListToFolder, removeListFromFolder })
  const selection = useListsSelection()
  const taskActions = useListsTaskActions(categories, folders, addTask, itemTypes)

  const [editingCategory, setEditingCategory] = useState<List | null>(null)
  const listsSurfaceRef = useRef<HTMLDivElement>(null)
  const [addingTaskToTarget, setAddingTaskToTarget] = useState<string | null>(null)
  const [showBulkAdd, setShowBulkAdd] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [showCategorySettings, setShowCategorySettings] = useState(false)
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null)
  const [selectBandPx, setSelectBandPx] = useState(0)
  const phoneLists = usePhoneListsLayout()
  const [phoneFoldersOpen, setPhoneFoldersOpen] = useState(true)

  const { location, openTarget, setOpenTarget, closeTarget, isHome, isAll, currentFolder, navTo, openEntry, openItemType, activeIconId, setActiveIconId, setLocation } = nav
  const { searchTerm, setSearchTerm, searchResetKey, clearSearch, searchActive, searchResults } = search
  const handleNavTo = useCallback(
    (loc: string) => chooseListsLocation(loc, navTo, clearSearch),
    [navTo, clearSearch],
  )
  const handleOpenEntry = useCallback(
    (entry: GridEntry) => {
      if (entry.kind === "folder") clearSearch()
      openEntry(entry)
    },
    [openEntry, clearSearch],
  )
  const { selectMode, selectedCategories, setSelectedCategories, selectedFolderIds, selectedTaskIds, toggleSelectMode, toggleCategorySelection, toggleFolderSelection, toggleTaskSelection, clearTaskSelection } = selection

  useListsShelfMaintenance({ allTasks, modules, dedupeFolders, dedupeLists })

  const shelf = useListsShelf({
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
  })

  const chrome = resolveOpenListChrome({
    openTarget,
    categories,
    itemTypes,
    currentFolder,
    listDisplay,
  })

  const openItems = useOpenListItems({
    openTarget,
    openCategory: chrome.openCategory,
    viewList: chrome.viewList,
    currentDisplay: chrome.currentDisplay,
    allTasks,
    categories,
    folders,
    currentFolder,
    itemTypes,
    getSmartTasks: shelf.getSmartTasks,
    getTasksForCategory: shelf.getTasksForCategory,
    updateList,
    hiddenItemTypeIdsByTarget,
    folderAllUncategorizedOnly,
    folderAllHideUncategorized,
    folderAllHiddenListIds,
    globalAllHiddenFolderIds,
    globalAllUncategorizedOnly,
    globalAllHideUncategorized,
    globalAllTasks: shelf.globalAllTasks,
  })

  const breadcrumb = getBreadcrumb({ searchActive, searchTerm, openTarget, openName: chrome.openName, isHome, isAll, isItemTypes: shelf.isItemTypes, currentFolderName: currentFolder?.name })
  const hereCount = openTarget
    ? `${openItems.listedTasks.length} item(s)`
    : `${shelf.entries.filter((e) => e.kind === "folder").length} folder(s), ${shelf.entries.filter((e) => e.kind !== "folder").length} list(s)`
  const treeCount = `${folders.length} folder(s), ${categories.length} list(s)`

  const selectActions = useListsSelectionActions({
    searchActive,
    searchResults,
    entries: shelf.entries,
    listedTasks: openItems.listedTasks,
    folders,
    categories,
    allTasks,
    openTarget,
    currentFolder,
    isAll,
    itemTypes,
    selectedTaskId,
    setSelectedTaskId,
    selection,
    addListToFolder,
    removeListFromFolder,
    updateFolder,
    updateTask,
    deleteTask,
    deleteList,
    deleteFolder,
    setLists,
    setFolders,
    setTasks,
    closeTarget,
    handleNavTo,
  })

  const create = useListsCreate({
    categories,
    folders,
    itemTypes,
    searchTerm,
    currentFolder,
    isHome,
    isAll,
    openTarget,
    selectedTaskIds,
    selectedCategories,
    selectedFolderIds,
    itemPlacementMode: selectActions.itemPlacementMode,
    placementMode: selectActions.placementMode,
    addList,
    addFolder,
    addListToFolder,
    removeListFromFolder,
    updateFolder,
    updateTask,
    toggleHomePin,
    cancelSelectMode: selection.cancelSelectMode,
  })

  const duplicate = useListsDuplicate({
    selectedCategories,
    selectedFolderIds,
    currentFolder,
    addFolder,
    addList,
    addListToFolder,
    addTask,
    cancelSelectMode: selection.cancelSelectMode,
    setEditingFolder,
    setEditingCategory,
  })

  const folderMenu = useFolderContextMenu({ folders, updateFolder })

  const clipboard = useListsClipboard({
    listsSurfaceRef,
    selectMode,
    selectedCategories,
    selectedFolderIds,
    currentFolder,
    addFolder,
    addList,
    addListToFolder,
    addTask,
  })

  const csv = useListsCsvImport({
    categories,
    currentFolder,
    isHome,
    addList,
    addTask,
    updateList,
    addListToFolder,
    toggleHomePin,
    taskActions,
    setListDisplay,
    setOpenTarget,
  })

  const icon = useListsIconChrome({
    openTarget,
    currentDisplay: chrome.currentDisplay,
    location,
    entries: shelf.entries,
    categories,
    folders,
    allTasks,
    iconPositions,
    listIconsDesktop,
    listIconsGravity,
    setListIconsGravity,
    commitIconLayout,
    updateList,
    updateFolder,
    updateTask,
  })

  const handleEditCategory = useCallback((category: List) => {
    updateList(category)
    setEditingCategory(null)
  }, [updateList])

  const openFolderAllSettings = useCallback(() => {
    if (chrome.isRootAll) {
      const existing = folderAllItemsList(useTaskStore.getState().lists, GLOBAL_ALL_ITEMS_KEY)
      if (existing) {
        setEditingCategory(existing)
        return
      }
      const created = buildGlobalAllItemsList()
      addList(created)
      setEditingCategory(created)
      return
    }
    if (!currentFolder || isScheduledFolderId(currentFolder.id)) return
    const existing = folderAllItemsList(useTaskStore.getState().lists, currentFolder.id)
    if (existing) {
      setEditingCategory(existing)
      return
    }
    const created = buildFolderAllItemsList(currentFolder)
    addList(created)
    if (!currentFolder.listIds.includes(created.id)) {
      updateFolder({ ...currentFolder, listIds: [created.id, ...currentFolder.listIds.filter((id) => id !== created.id)] })
    }
    setEditingCategory(created)
  }, [chrome.isRootAll, currentFolder, addList, updateFolder])

  useEffect(() => {
    clearTaskSelection()
  }, [icon.openListKey, clearTaskSelection])

  return (
    <div
      ref={listsSurfaceRef}
      className={phoneLists ? "fm98 fm-phone" : "fm98"}
      style={{
        // Select mode adds the control strip inside a fixed viewport. Grow the
        // window by that band so the folder tree and content keep the height
        // they have when select mode is off.
        height: selectBandPx ? `calc(100vh - 150px + ${selectBandPx}px)` : "calc(100vh - 150px)",
        minHeight: 560 + selectBandPx,
      }}
    >
      <div
        className="fm-window"
        data-ui-name="Lists"
        data-ui-help="Folders, lists, and items in a file-manager window."
        data-ui-docs="components/Lists/README.md"
      >
        <ListsTitleBar
          openIconKey={chrome.openIconKey}
          openTarget={openTarget}
          openName={chrome.openName}
          closeTarget={closeTarget}
        />

        <div className="fm-window-body">
          <ListsToolbar
            openTarget={openTarget}
            isHome={isHome}
            isAll={isAll}
            searchResetKey={searchResetKey}
            searchActive={searchActive}
            selectMode={selectMode}
            folderView={folderView}
            currentDisplay={chrome.currentDisplay}
            location={location}
            entryKeys={shelf.entries.map((e) => `${e.kind}-${e.id}`)}
            enabledDisplays={chrome.offeredDisplays}
            onUp={() => { clearSearch(); if (openTarget) closeTarget(); else navTo("all"); setActiveIconId(null) }}
            onNewList={create.openNewCategoryDialog}
            onNewFolder={() => create.setShowNewFolderDialog(true)}
            onImportCsv={() => csv.csvRef.current?.click()}
            onSettings={() => setShowCategorySettings(true)}
            onToggleSelect={toggleSelectMode}
            onSearchChange={setSearchTerm}
            onClearSearch={clearSearch}
            onFolderViewChange={setFolderView}
            onListDisplayChange={setListDisplay}
            onAutoOrganize={icon.handleAutoOrganize}
            listIconsDesktop={icon.listIconsDesktopOn}
            onListDesktopOrganize={icon.onListDesktopOrganize}
            listIconsGravity={icon.listIconsGravityOn}
            onListIconsGravityChange={icon.onListIconsGravityChange}
            onGravityReset={icon.onGravityReset}
            onGravitySettle={icon.onGravitySettle}
            onGravitySettings={icon.onGravitySettings}
            onPileUp={icon.onPileUp}
          />
          <input
            ref={csv.csvRef}
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            hidden
            onChange={csv.handleCsvFile}
          />

          <ListsAddressBar
            breadcrumb={breadcrumb}
            foldersOpen={phoneLists ? phoneFoldersOpen : undefined}
            onToggleFolders={phoneLists ? () => setPhoneFoldersOpen((open) => !open) : undefined}
          />

          <ListsSelectStrip
            selectStripOpen={selectActions.selectStripOpen}
            setSelectBandPx={setSelectBandPx}
            itemSelectActive={selectActions.itemSelectActive}
            listSelectActive={selectActions.listSelectActive}
            selectedTaskIds={selectedTaskIds}
            effectiveItemPlacement={selectActions.effectiveItemPlacement}
            itemCanMove={selectActions.itemCanMove}
            selectingSearchResults={selectActions.selectingSearchResults}
            categories={categories}
            originListId={selectActions.originListId}
            handleSelectAllSearchResults={selectActions.handleSelectAllSearchResults}
            handleSelectAllItems={selectActions.handleSelectAllItems}
            clearTaskSelection={selectActions.clearTaskSelection}
            clearSelection={selectActions.clearSelection}
            setItemPlacementMode={selectActions.setItemPlacementMode}
            openNewCategoryDialog={create.openNewCategoryDialog}
            placeItemsIntoLists={selectActions.placeItemsIntoLists}
            setItemMergeConfirmOpen={selectActions.setItemMergeConfirmOpen}
            handleDeleteSelectedItems={selectActions.handleDeleteSelectedItems}
            selectedCategories={selectedCategories}
            selectedFolderIds={selectedFolderIds}
            effectivePlacement={selectActions.effectivePlacement}
            isAll={isAll}
            searchActive={searchActive}
            folders={folders}
            currentFolder={currentFolder}
            handleSelectAllVisible={selectActions.handleSelectAllVisible}
            setPlacementMode={selectActions.setPlacementMode}
            setShowNewFolderDialog={create.setShowNewFolderDialog}
            placeListsIntoFolder={selectActions.placeListsIntoFolder}
            setMergeConfirmOpen={selectActions.setMergeConfirmOpen}
            handleDeleteSelected={selectActions.handleDeleteSelected}
            openDuplicateSelection={duplicate.openDuplicateSelection}
          />

          <div className="fm-split">
            <FolderTree
              folders={folders}
              location={location}
              openTarget={openTarget}
              isHome={isHome}
              isAll={isAll}
              onNavTo={handleNavTo}
              onDragOver={drag.handleDragOver}
              onDrop={drag.handleFolderTreeDrop}
              onCreateFolder={() => create.setShowNewFolderDialog(true)}
              onEditFolder={setEditingFolder}
              itemTypes={itemTypes}
              onOpenItemType={openItemType}
              collapsed={phoneLists && !phoneFoldersOpen}
            />

            <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <ListInnerCaption
                openTarget={openTarget}
                innerCaption={chrome.innerCaption}
                listSearchOpen={openItems.listSearchOpen}
                listSearchable={openItems.listSearchable}
                listSearchQuery={openItems.listSearchQuery}
                setListSearchQuery={openItems.setListSearchQuery}
                listSearchAllFields={openItems.listSearchAllFields}
                setListSearchAllFields={openItems.setListSearchAllFields}
                shownCount={openItems.shownTasks.length}
                closeListSearch={openItems.closeListSearch}
                setListSearchOpen={openItems.setListSearchOpen}
                setAddingTaskToTarget={setAddingTaskToTarget}
                openCategory={chrome.openCategory}
                canEditFolderAllSettings={chrome.canEditFolderAllSettings}
                setEditingCategory={setEditingCategory}
                openFolderAllSettings={openFolderAllSettings}
                closeTarget={closeTarget}
              />
              <ListsMainPane
                searchActive={searchActive}
                searchTerm={searchTerm}
                searchResults={searchResults}
                getTasksForCategory={shelf.getTasksForCategory}
                handleNavTo={handleNavTo}
                folders={folders}
                setLocation={setLocation}
                setOpenTarget={setOpenTarget}
                clearSearch={clearSearch}
                setSelectedTaskId={setSelectedTaskId}
                selectMode={selectMode}
                selectedFolderIds={selectedFolderIds}
                selectedCategories={selectedCategories}
                selectedTaskIds={selectedTaskIds}
                toggleFolderSelection={toggleFolderSelection}
                toggleCategorySelection={toggleCategorySelection}
                toggleTaskSelection={toggleTaskSelection}
                openTarget={openTarget}
                shownTasks={openItems.shownTasks}
                currentSort={openItems.currentSort}
                sortOptions={openItems.sortOptions}
                handleSortChange={openItems.handleSortChange}
                listSearchQuery={openItems.listSearchQuery}
                openCategory={chrome.openCategory}
                showSentItems={openItems.showSentItems}
                setShowSentItems={openItems.setShowSentItems}
                currentDisplay={chrome.currentDisplay}
                categories={categories}
                viewList={chrome.viewList}
                openFolderAll={chrome.openFolderAll}
                openSmart={chrome.openSmart}
                currentFolder={currentFolder}
                isRootAll={chrome.isRootAll}
                openTypeList={chrome.openTypeList}
                itemLabelFor={shelf.itemLabelFor}
                openIconKey={chrome.openIconKey}
                folderAllUncategorizedOnly={folderAllUncategorizedOnly}
                setFolderAllUncategorizedOnly={setFolderAllUncategorizedOnly}
                folderAllHiddenListIds={folderAllHiddenListIds}
                folderAllHideUncategorized={folderAllHideUncategorized}
                globalAllHiddenFolderIds={globalAllHiddenFolderIds}
                globalAllUncategorizedOnly={globalAllUncategorizedOnly}
                setGlobalAllUncategorizedOnly={setGlobalAllUncategorizedOnly}
                globalAllHideUncategorized={globalAllHideUncategorized}
                addingTaskToTarget={addingTaskToTarget}
                setAddingTaskToTarget={setAddingTaskToTarget}
                taskActions={taskActions}
                addTask={addTask}
                showBulkAdd={showBulkAdd}
                setShowBulkAdd={setShowBulkAdd}
                drag={drag}
                setIconPickerFor={icon.setIconPickerFor}
                listIconsDesktopOn={icon.listIconsDesktopOn}
                listDesktopOrganizeEpoch={icon.listDesktopOrganizeEpoch}
                listPileEpoch={icon.listPileEpoch}
                listGravityResetEpoch={icon.listGravityResetEpoch}
                listGravitySettleEpoch={icon.listGravitySettleEpoch}
                folderView={folderView}
                location={location}
                entries={shelf.entries}
                activeIconId={activeIconId}
                setActiveIconId={setActiveIconId}
                handleOpenEntry={handleOpenEntry}
                isHome={isHome}
                homePinned={homePinned}
                iconPositions={iconPositions}
                iconLayoutMode={iconLayoutMode}
                organizeEpoch={icon.organizeEpoch}
                organizeFromSnapshot={icon.organizeFromSnapshot}
                setOrganizeFromSnapshot={icon.setOrganizeFromSnapshot}
                setIconPosition={setIconPosition}
                commitIconLayout={commitIconLayout}
                setSelectedCategories={setSelectedCategories}
                toggleHomePin={toggleHomePin}
                openNewCategoryDialog={create.openNewCategoryDialog}
                handleCanvasWidth={icon.handleCanvasWidth}
                folderRenameProps={folderMenu.folderRenameProps}
                getCategoryCompletionRate={shelf.getCategoryCompletionRate}
                categoryById={shelf.categoryById}
                getSmartTasks={shelf.getSmartTasks}
                deleteList={deleteList}
                setEditingCategory={setEditingCategory}
              />
            </div>

            <ListsInspector
              openCategory={chrome.openCategory}
              openFolderAll={chrome.openFolderAll}
              isRootAll={chrome.isRootAll}
              currentFolder={currentFolder}
              openSmart={chrome.openSmart}
              openTarget={openTarget}
              listedTasks={openItems.listedTasks}
              openTasks={openItems.openTasks}
              itemLabelFor={shelf.itemLabelFor}
              currentDisplay={chrome.currentDisplay}
              setEditingCategory={setEditingCategory}
              setIconPickerFor={icon.setIconPickerFor}
              homePinned={homePinned}
              toggleHomePin={toggleHomePin}
              typeFilterForOpen={openItems.typeFilterForOpen}
              hiddenItemTypeIdsByTarget={hiddenItemTypeIdsByTarget}
              setItemTypeHidden={setItemTypeHidden}
              setHiddenItemTypeIds={setHiddenItemTypeIds}
              canEditFolderAllSettings={chrome.canEditFolderAllSettings}
              openFolderAllSettings={openFolderAllSettings}
              folders={folders}
              categories={categories}
              globalAllHiddenFolderIds={globalAllHiddenFolderIds}
              setGlobalAllFolderHidden={setGlobalAllFolderHidden}
              setGlobalAllHiddenFolderIds={setGlobalAllHiddenFolderIds}
              globalAllHideUncategorized={globalAllHideUncategorized}
              setGlobalAllHideUncategorized={setGlobalAllHideUncategorized}
              folderAllHiddenListIds={folderAllHiddenListIds}
              setFolderAllListHidden={setFolderAllListHidden}
              setFolderAllHiddenListIds={setFolderAllHiddenListIds}
              folderAllHideUncategorized={folderAllHideUncategorized}
              setFolderAllHideUncategorized={setFolderAllHideUncategorized}
              setAddingTaskToTarget={setAddingTaskToTarget}
              setEditingFolder={setEditingFolder}
              openNewCategoryDialog={create.openNewCategoryDialog}
            />
          </div>

          <ListsStatusBar
            hereCount={hereCount}
            treeCount={treeCount}
            showSmartLists={showSmartLists}
            setShowSmartLists={setShowSmartLists}
            isAll={isAll}
            showPeriodLedgerListsInAll={showPeriodLedgerListsInAll}
            setShowPeriodLedgerListsInAll={setShowPeriodLedgerListsInAll}
          />
        </div>
      </div>

      <ListsDialogHost
        newCategoryOpen={create.newCategoryOpen}
        setNewCategoryOpen={create.setNewCategoryOpen}
        currentFolder={currentFolder}
        isHome={isHome}
        isAll={isAll}
        selectedTaskIds={selectedTaskIds}
        effectiveItemPlacement={selectActions.effectiveItemPlacement}
        itemCanMove={selectActions.itemCanMove}
        setItemPlacementMode={selectActions.setItemPlacementMode}
        newListSeed={create.newListSeed}
        handleCreateCategory={create.handleCreateCategory}
        handleBulkCreateLists={create.handleBulkCreateLists}
        csvImport={csv.csvImport}
        setCsvImport={csv.setCsvImport}
        performCsvImport={csv.performCsvImport}
        editingCategory={editingCategory}
        setEditingCategory={setEditingCategory}
        folders={folders}
        homePinned={homePinned}
        listDisplay={listDisplay}
        setListDisplay={setListDisplay}
        toggleHomePin={toggleHomePin}
        setIconPickerFor={icon.setIconPickerFor}
        handleEditCategory={handleEditCategory}
        deleteList={deleteList}
        openTarget={openTarget}
        closeTarget={closeTarget}
        openDuplicateList={duplicate.openDuplicateList}
        editingFolder={editingFolder}
        setEditingFolder={setEditingFolder}
        updateFolder={updateFolder}
        deleteFolder={deleteFolder}
        location={location}
        handleNavTo={handleNavTo}
        openDuplicateFolder={duplicate.openDuplicateFolder}
        showNewFolderDialog={create.showNewFolderDialog}
        setShowNewFolderDialog={create.setShowNewFolderDialog}
        selectedCategories={selectedCategories}
        selectedFolderIds={selectedFolderIds}
        effectivePlacement={selectActions.effectivePlacement}
        setPlacementMode={selectActions.setPlacementMode}
        handleCreateFolder={create.handleCreateFolder}
        handleBulkCreateFolders={create.handleBulkCreateFolders}
        duplicateOpen={duplicate.duplicateOpen}
        setDuplicateOpen={duplicate.setDuplicateOpen}
        duplicateSubject={duplicate.duplicateSubject}
        setDuplicateSubject={duplicate.setDuplicateSubject}
        categories={categories}
        handleConfirmDuplicate={duplicate.handleConfirmDuplicate}
        pasteOpen={clipboard.pasteOpen}
        setPasteOpen={clipboard.setPasteOpen}
        listsClipboard={clipboard.listsClipboard}
        pasteSameEnabled={clipboard.pasteSameEnabled}
        pasteSameDisabledReason={clipboard.pasteSameDisabledReason}
        handleConfirmPaste={clipboard.handleConfirmPaste}
        folderContextMenu={folderMenu.folderContextMenu}
        setFolderContextMenu={folderMenu.setFolderContextMenu}
        setRenamingFolderId={folderMenu.setRenamingFolderId}
        handleOpenEntry={handleOpenEntry}
        mergeConfirmOpen={selectActions.mergeConfirmOpen}
        setMergeConfirmOpen={selectActions.setMergeConfirmOpen}
        selectedMergeLists={selectActions.selectedMergeLists}
        setMergeOpen={selectActions.setMergeOpen}
        mergeOpen={selectActions.mergeOpen}
        allTasks={allTasks}
        handleApplyMerge={selectActions.handleApplyMerge}
        itemMergeConfirmOpen={selectActions.itemMergeConfirmOpen}
        setItemMergeConfirmOpen={selectActions.setItemMergeConfirmOpen}
        selectedMergeItems={selectActions.selectedMergeItems}
        itemMergeOpen={selectActions.itemMergeOpen}
        setItemMergeOpen={selectActions.setItemMergeOpen}
        handleApplyItemMerge={selectActions.handleApplyItemMerge}
        showCategorySettings={showCategorySettings}
        setShowCategorySettings={setShowCategorySettings}
        gravitySettingsOpen={icon.gravitySettingsOpen}
        setGravitySettingsOpen={icon.setGravitySettingsOpen}
        selectedTaskId={selectedTaskId}
        setSelectedTaskId={setSelectedTaskId}
        iconPickerFor={icon.iconPickerFor}
        iconPickerCurrent={icon.iconPickerCurrent}
        applyIcon={icon.applyIcon}
      />
    </div>
  )
}
