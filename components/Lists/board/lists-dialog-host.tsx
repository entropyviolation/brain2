"use client"

/**
 * components/Lists/board/lists-dialog-host.tsx
 *
 * Dialogs and popups that sit beside the file-manager window. The hidden
 * spreadsheet input stays in the window body. Confirm copy is unchanged.
 */
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { isRemindersList } from "@/lib/reminders"
import { isPeopleIKnowList } from "@/lib/people-i-know"
import { isInstagramPeopleList } from "@/lib/instagram-lists"
import { isEditableFolder } from "@/lib/folder-tree"
import { itemMergeLabel, type ItemMergePlan } from "@/lib/item-merge"
import type { ListMergePlan } from "@/lib/list-merge"
import type { ListDisplay } from "@/lib/lists-ui-store"
import type { DuplicateScope } from "@/lib/lists-duplicate"
import type { ListsClipboardPayload, PasteMode } from "@/lib/lists-clipboard"
import type { ListPlacementMode } from "@/lib/folder-selection"
import type { ItemPlacementMode } from "@/lib/item-selection"
import type { Folder, List, Task } from "@/lib/types"
import { TaskDetailPopup } from "@/components/ItemDetail/ItemDetailPopup"
import { NextActionsSettingsDialog } from "@/components/Lists/settings-dialog"
import { OrbPickerDialog } from "@/components/Icons/OrbPicker"
import { CsvImportDialog } from "@/components/Lists/dialogs/CsvImportDialog"
import { NewListDialog } from "@/components/Lists/dialogs/NewListDialog"
import { NewFolderDialog } from "@/components/Lists/dialogs/NewFolderDialog"
import { MergeListsConfirmDialog } from "@/components/Lists/dialogs/MergeListsConfirmDialog"
import { MergeListsDialog } from "@/components/Lists/dialogs/MergeListsDialog"
import { MergeItemsConfirmDialog } from "@/components/Lists/dialogs/MergeItemsConfirmDialog"
import { MergeItemsDialog } from "@/components/Lists/dialogs/MergeItemsDialog"
import { EditListDialog } from "@/components/Lists/dialogs/EditListDialog"
import { EditFolderDialog } from "@/components/Lists/dialogs/EditFolderDialog"
import { DuplicateSelectionDialog } from "@/components/Lists/dialogs/DuplicateSelectionDialog"
import { PasteSelectionDialog } from "@/components/Lists/dialogs/PasteSelectionDialog"
import { GravitySettingsDialog } from "@/components/Lists/dialogs/GravitySettingsDialog"
import {
  FolderContextMenu,
  type FolderContextMenuState,
} from "@/components/Lists/views/FolderContextMenu"
import type { CsvImportState, GridEntry, IconPickerTarget, OpenTarget } from "@/components/Lists/types"
import type { NewListFields } from "@/components/Lists/dialogs/NewListDialog"
import type { NewFolderFields } from "@/components/Lists/dialogs/NewFolderDialog"

export function ListsDialogHost({
  newCategoryOpen,
  setNewCategoryOpen,
  currentFolder,
  isHome,
  isAll,
  selectedTaskIds,
  effectiveItemPlacement,
  itemCanMove,
  setItemPlacementMode,
  newListSeed,
  handleCreateCategory,
  handleBulkCreateLists,
  csvImport,
  setCsvImport,
  performCsvImport,
  editingCategory,
  setEditingCategory,
  folders,
  homePinned,
  listDisplay,
  setListDisplay,
  toggleHomePin,
  setIconPickerFor,
  handleEditCategory,
  deleteList,
  openTarget,
  closeTarget,
  openDuplicateList,
  editingFolder,
  setEditingFolder,
  updateFolder,
  deleteFolder,
  location,
  handleNavTo,
  openDuplicateFolder,
  showNewFolderDialog,
  setShowNewFolderDialog,
  selectedCategories,
  selectedFolderIds,
  effectivePlacement,
  setPlacementMode,
  handleCreateFolder,
  handleBulkCreateFolders,
  duplicateOpen,
  setDuplicateOpen,
  duplicateSubject,
  setDuplicateSubject,
  categories,
  handleConfirmDuplicate,
  pasteOpen,
  setPasteOpen,
  listsClipboard,
  pasteSameEnabled,
  pasteSameDisabledReason,
  handleConfirmPaste,
  folderContextMenu,
  setFolderContextMenu,
  setRenamingFolderId,
  handleOpenEntry,
  mergeConfirmOpen,
  setMergeConfirmOpen,
  selectedMergeLists,
  setMergeOpen,
  mergeOpen,
  allTasks,
  handleApplyMerge,
  itemMergeConfirmOpen,
  setItemMergeConfirmOpen,
  selectedMergeItems,
  itemMergeOpen,
  setItemMergeOpen,
  handleApplyItemMerge,
  showCategorySettings,
  setShowCategorySettings,
  gravitySettingsOpen,
  setGravitySettingsOpen,
  selectedTaskId,
  setSelectedTaskId,
  iconPickerFor,
  iconPickerCurrent,
  applyIcon,
}: {
  newCategoryOpen: boolean
  setNewCategoryOpen: (open: boolean) => void
  currentFolder: Folder | null
  isHome: boolean
  isAll: boolean
  selectedTaskIds: string[]
  effectiveItemPlacement: ItemPlacementMode
  itemCanMove: boolean
  setItemPlacementMode: (mode: ItemPlacementMode) => void
  newListSeed: string
  handleCreateCategory: (fields: NewListFields) => void
  handleBulkCreateLists: (fields: Omit<NewListFields, "name"> & { names: string[] }) => void
  csvImport: CsvImportState | null
  setCsvImport: (next: CsvImportState | null) => void
  performCsvImport: () => void
  editingCategory: List | null
  setEditingCategory: (list: List | null) => void
  folders: Folder[]
  homePinned: string[]
  listDisplay: Record<string, ListDisplay>
  setListDisplay: (id: string, display: ListDisplay) => void
  toggleHomePin: (id: string) => void
  setIconPickerFor: (target: IconPickerTarget) => void
  handleEditCategory: (category: List) => void
  deleteList: (id: string) => void
  openTarget: OpenTarget
  closeTarget: () => void
  openDuplicateList: (list: List) => void
  editingFolder: Folder | null
  setEditingFolder: (folder: Folder | null) => void
  updateFolder: (folder: Folder) => void
  deleteFolder: (id: string) => void
  location: string
  handleNavTo: (loc: string) => void
  openDuplicateFolder: (folder: Folder) => void
  showNewFolderDialog: boolean
  setShowNewFolderDialog: (open: boolean) => void
  selectedCategories: string[]
  selectedFolderIds: string[]
  effectivePlacement: ListPlacementMode
  setPlacementMode: (mode: ListPlacementMode) => void
  handleCreateFolder: (fields: NewFolderFields) => void
  handleBulkCreateFolders: (fields: Omit<NewFolderFields, "name"> & { names: string[] }) => void
  duplicateOpen: boolean
  setDuplicateOpen: (open: boolean) => void
  duplicateSubject: null | { kind: "selection" } | { kind: "folder"; id: string } | { kind: "list"; id: string }
  setDuplicateSubject: (subject: null | { kind: "selection" } | { kind: "folder"; id: string } | { kind: "list"; id: string }) => void
  categories: List[]
  handleConfirmDuplicate: (scope: DuplicateScope) => void
  pasteOpen: boolean
  setPasteOpen: (open: boolean) => void
  listsClipboard: ListsClipboardPayload | null
  pasteSameEnabled: boolean
  pasteSameDisabledReason: string
  handleConfirmPaste: (mode: PasteMode) => void
  folderContextMenu: FolderContextMenuState | null
  setFolderContextMenu: (menu: FolderContextMenuState | null) => void
  setRenamingFolderId: (id: string | null) => void
  handleOpenEntry: (entry: GridEntry) => void
  mergeConfirmOpen: boolean
  setMergeConfirmOpen: (open: boolean) => void
  selectedMergeLists: List[]
  setMergeOpen: (open: boolean) => void
  mergeOpen: boolean
  allTasks: Task[]
  handleApplyMerge: (plan: ListMergePlan) => void
  itemMergeConfirmOpen: boolean
  setItemMergeConfirmOpen: (open: boolean) => void
  selectedMergeItems: Task[]
  itemMergeOpen: boolean
  setItemMergeOpen: (open: boolean) => void
  handleApplyItemMerge: (plan: ItemMergePlan) => void
  showCategorySettings: boolean
  setShowCategorySettings: (open: boolean) => void
  gravitySettingsOpen: boolean
  setGravitySettingsOpen: (open: boolean) => void
  selectedTaskId: string | null
  setSelectedTaskId: (id: string | null) => void
  iconPickerFor: IconPickerTarget
  iconPickerCurrent: string | undefined
  applyIcon: (icon: string | undefined) => void
}) {
  return (
    <>
      <NewListDialog open={newCategoryOpen} currentFolder={currentFolder} isHome={isHome} selectedCount={selectedTaskIds.length} placementMode={effectiveItemPlacement} canMove={itemCanMove} onPlacementModeChange={setItemPlacementMode} initialName={newListSeed} onOpenChange={setNewCategoryOpen} onCreate={handleCreateCategory} onBulkCreate={handleBulkCreateLists} />
      {csvImport && <CsvImportDialog csvImport={csvImport} onClose={() => setCsvImport(null)} onImport={performCsvImport} onUpdate={setCsvImport} />}
      <EditListDialog editingCategory={editingCategory} onEditingCategoryChange={setEditingCategory} folders={folders} homePinned={homePinned} listDisplay={listDisplay} setListDisplay={setListDisplay} toggleHomePin={toggleHomePin} onOpenIconPicker={() => editingCategory && setIconPickerFor({ kind: "category", id: editingCategory.id })} onSave={handleEditCategory} onDelete={() => { if (!editingCategory || isFolderAllItemsCategoryId(editingCategory.id) || isRemindersList(editingCategory) || isPeopleIKnowList(editingCategory) || isInstagramPeopleList(editingCategory)) return; if (confirm(`Delete list "${editingCategory.name}"?`)) { deleteList(editingCategory.id); if (openTarget?.type === "category" && openTarget.id === editingCategory.id) closeTarget(); setEditingCategory(null) } }} onDuplicate={() => editingCategory && openDuplicateList(editingCategory)} />
      <EditFolderDialog editingFolder={editingFolder} onEditingFolderChange={setEditingFolder} homePinned={homePinned} toggleHomePin={toggleHomePin} onOpenIconPicker={() => editingFolder && setIconPickerFor({ kind: "folder", id: editingFolder.id })} onSave={(folder) => { updateFolder(folder); setEditingFolder(null) }} onDelete={() => { if (editingFolder && confirm("Delete this folder? The lists inside it will not be deleted.")) { deleteFolder(editingFolder.id); if (location === editingFolder.id) handleNavTo("all"); setEditingFolder(null) } }} onDuplicate={() => editingFolder && openDuplicateFolder(editingFolder)} />
      <NewFolderDialog open={showNewFolderDialog} selectedCount={selectedCategories.length + selectedFolderIds.length} placementMode={effectivePlacement} originIsAll={isAll} onPlacementModeChange={setPlacementMode} onOpenChange={setShowNewFolderDialog} onCreate={handleCreateFolder} onBulkCreate={handleBulkCreateFolders} />
      <DuplicateSelectionDialog
        open={duplicateOpen}
        folderCount={
          duplicateSubject?.kind === "folder"
            ? 1
            : duplicateSubject?.kind === "list"
              ? 0
              : selectedFolderIds.length
        }
        listCount={
          duplicateSubject?.kind === "list"
            ? 1
            : duplicateSubject?.kind === "folder"
              ? 0
              : selectedCategories.length
        }
        subjectLabel={
          duplicateSubject?.kind === "folder"
            ? folders.find((f) => f.id === duplicateSubject.id)?.name
            : duplicateSubject?.kind === "list"
              ? categories.find((l) => l.id === duplicateSubject.id)?.name
              : undefined
        }
        onOpenChange={(open) => {
          setDuplicateOpen(open)
          if (!open) setDuplicateSubject(null)
        }}
        onConfirm={handleConfirmDuplicate}
      />
      <PasteSelectionDialog
        open={pasteOpen}
        folderCount={listsClipboard?.folderIds.length ?? 0}
        listCount={listsClipboard?.listIds.length ?? 0}
        sameEnabled={pasteSameEnabled}
        sameDisabledReason={pasteSameDisabledReason}
        onOpenChange={setPasteOpen}
        onConfirm={handleConfirmPaste}
      />
      {folderContextMenu ? (
        <FolderContextMenu
          menu={folderContextMenu}
          canRename={isEditableFolder(folderContextMenu.folderId)}
          onClose={() => setFolderContextMenu(null)}
          onOpen={() => {
            const folder = folders.find((f) => f.id === folderContextMenu.folderId)
            setFolderContextMenu(null)
            if (folder) handleOpenEntry({ kind: "folder", id: folder.id, name: folder.name, count: 0 })
          }}
          onRename={() => {
            const id = folderContextMenu.folderId
            setFolderContextMenu(null)
            if (isEditableFolder(id)) setRenamingFolderId(id)
          }}
          onFolderSettings={() => {
            const folder = folders.find((f) => f.id === folderContextMenu.folderId)
            setFolderContextMenu(null)
            if (folder && isEditableFolder(folder.id)) setEditingFolder(folder)
          }}
        />
      ) : null}
      <MergeListsConfirmDialog open={mergeConfirmOpen} listNames={selectedMergeLists.map((l) => l.name)} onCancel={() => setMergeConfirmOpen(false)} onContinue={() => { setMergeConfirmOpen(false); setMergeOpen(true) }} />
      <MergeListsDialog open={mergeOpen} lists={selectedMergeLists} folders={folders} tasks={allTasks} onClose={() => setMergeOpen(false)} onMerge={handleApplyMerge} />
      <MergeItemsConfirmDialog open={itemMergeConfirmOpen} itemNames={selectedMergeItems.map(itemMergeLabel)} onCancel={() => setItemMergeConfirmOpen(false)} onContinue={() => { setItemMergeConfirmOpen(false); setItemMergeOpen(true) }} />
      <MergeItemsDialog open={itemMergeOpen} items={selectedMergeItems} lists={categories} onClose={() => setItemMergeOpen(false)} onMerge={handleApplyItemMerge} />
      <NextActionsSettingsDialog open={showCategorySettings} onClose={() => setShowCategorySettings(false)} />
      <GravitySettingsDialog open={gravitySettingsOpen} onOpenChange={setGravitySettingsOpen} />
      <TaskDetailPopup taskId={selectedTaskId} open={!!selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      <OrbPickerDialog open={!!iconPickerFor} current={iconPickerCurrent} onClose={() => setIconPickerFor(null)} onSelect={applyIcon} />
    </>
  )
}
