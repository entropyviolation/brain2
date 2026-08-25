"use client"

import { Textarea } from "@/components/ui/textarea"
import { isScheduledFolderId } from "@/lib/scheduled-lists-sync"
import { listsInFolderForFilter } from "@/lib/folder-all-items"
import { ListContentDefault } from "./ListContentDefault"
import { ListContentChecklist } from "./ListContentChecklist"
import { ListContentIcons } from "./ListContentIcons"
import { ListContentDetails } from "./ListContentDetails"
import { ListContentSpreadsheet } from "./ListContentSpreadsheet"
import { ListContentKanban } from "./ListContentKanban"
import type { ListContentPanelProps } from "./types"
import type { Folder, List } from "@/lib/types"

export type { ListContentPanelProps } from "./types"

function FolderAllListFilter({
  folder,
  lists,
  hiddenListIds,
  onHiddenChange,
}: {
  folder: Folder
  lists: List[]
  hiddenListIds: string[]
  onHiddenChange: (folderId: string, listId: string, hidden: boolean) => void
}) {
  if (lists.length === 0) return null
  const hidden = new Set(hiddenListIds)
  return (
    <div className="fm-list-filter" role="group" aria-label="Filter lists">
      {lists.map((list) => (
        <label key={list.id} className="fm-list-filter-item">
          <input
            type="checkbox"
            checked={!hidden.has(list.id)}
            onChange={(e) => onHiddenChange(folder.id, list.id, !e.target.checked)}
          />
          {list.name}
        </label>
      ))}
    </div>
  )
}

export function ListContentPanel({
  tasks,
  currentDisplay,
  categories,
  folders,
  openCategory,
  openFolderAll,
  openSmart,
  currentFolder,
  itemLabel,
  openIconKey,
  folderAllUncategorizedOnly,
  onFolderAllUncategorizedOnlyChange,
  folderAllHiddenListIds,
  onFolderAllListHiddenChange,
  addingTaskToTarget,
  openTargetKeyValue,
  newTaskDescription,
  onNewTaskDescriptionChange,
  onAddTask,
  onCancelAddTask,
  showBulkAdd,
  bulkAddText,
  onBulkAddTextChange,
  onBulkAdd,
  onShowBulkAdd,
  onBulkAddCancel,
  onTaskSelect,
  onCompleteTask,
  onTaskDragStart,
  onDragEnd,
  onIconPickerOpen,
  selectMode,
  selectedTaskIds,
  onToggleTaskSelect,
}: ListContentPanelProps) {
  const showFolderAllListFilter =
    currentDisplay === "default" &&
    openFolderAll &&
    !!currentFolder &&
    !isScheduledFolderId(currentFolder.id)
  const folderFilterLists =
    showFolderAllListFilter && currentFolder ? listsInFolderForFilter(currentFolder, categories) : []
  const hiddenForFolder = currentFolder ? folderAllHiddenListIds[currentFolder.id] ?? [] : []

  const uncategorizedFilter =
    openFolderAll && currentFolder && !isScheduledFolderId(currentFolder.id) ? (
      <div className="fm-toolbar" style={{ marginBottom: 6, padding: "4px 8px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={!!folderAllUncategorizedOnly[currentFolder.id]}
            onChange={(e) => onFolderAllUncategorizedOnlyChange(currentFolder.id, e.target.checked)}
          />
          Show uncategorized only
        </label>
      </div>
    ) : null

  const listFilter =
    showFolderAllListFilter && currentFolder ? (
      <FolderAllListFilter
        folder={currentFolder}
        lists={folderFilterLists}
        hiddenListIds={hiddenForFolder}
        onHiddenChange={onFolderAllListHiddenChange}
      />
    ) : null

  const quickAdd =
    addingTaskToTarget === openTargetKeyValue ? (
      <div className="fm-quickadd">
        <Textarea
          placeholder={`Enter ${itemLabel.toLowerCase()} description...`}
          value={newTaskDescription}
          onChange={(e) => onNewTaskDescriptionChange(e.target.value)}
          rows={2}
        />
        <div className="flex gap-2">
          <button className="fm-btn fm-btn-sm" onClick={onAddTask}>
            Add {itemLabel}
          </button>
          <button className="fm-btn fm-btn-sm" onClick={onCancelAddTask}>
            Cancel
          </button>
        </div>
      </div>
    ) : null

  const bulkAddPanel = showBulkAdd ? (
    <div className="fm-quickadd" style={{ marginTop: 8 }}>
      <Textarea
        placeholder={`Paste one ${itemLabel.toLowerCase()} per line…`}
        value={bulkAddText}
        onChange={(e) => onBulkAddTextChange(e.target.value)}
        rows={5}
      />
      <div className="flex gap-2">
        <button className="fm-btn fm-btn-sm" onClick={onBulkAdd}>
          Add all
        </button>
        <button className="fm-btn fm-btn-sm" onClick={onBulkAddCancel}>
          Cancel
        </button>
      </div>
    </div>
  ) : (
    <button className="fm-btn fm-btn-sm" style={{ marginTop: 8 }} onClick={() => onShowBulkAdd(true)}>
      Bulk add {itemLabel.toLowerCase()}s
    </button>
  )

  const taskHandlers = {
    tasks,
    onTaskSelect,
    onCompleteTask,
    onTaskDragStart,
    onDragEnd,
    selectMode,
    selectedTaskIds,
    onToggleTaskSelect,
  }

  const emptyMessage = folderAllUncategorizedOnly[currentFolder?.id || ""]
    ? "No uncategorized items in this folder."
    : hiddenForFolder.length > 0
      ? "No items in the selected lists."
      : openSmart
        ? "Nothing scheduled for this period."
        : `No active ${itemLabel.toLowerCase()}s in this list.`

  if (tasks.length === 0) {
    return (
      <div className="fm-sunken">
        {uncategorizedFilter}
        {quickAdd}
        {!addingTaskToTarget && bulkAddPanel}
        {listFilter}
        <div className="fm-empty">
          <img src={openIconKey} alt="" style={{ width: 56, height: 56, opacity: 0.6 }} loading="lazy" decoding="async" />
          <p>{emptyMessage}</p>
        </div>
      </div>
    )
  }

  let body = null
  if (currentDisplay === "default") {
    body = <ListContentDefault {...taskHandlers} openCategory={openCategory} categories={categories} />
  } else if (currentDisplay === "checklist") {
    body = <ListContentChecklist {...taskHandlers} />
  } else if (currentDisplay === "icons") {
    body = <ListContentIcons {...taskHandlers} onIconPickerOpen={onIconPickerOpen} />
  } else if (currentDisplay === "kanban") {
    body = (
      <ListContentKanban
        {...taskHandlers}
        openCategory={openCategory}
        listKey={openTargetKeyValue}
      />
    )
  } else if (currentDisplay === "spreadsheet") {
    body = (
      <ListContentSpreadsheet
        {...taskHandlers}
        openCategory={openCategory}
        categories={categories}
        folders={folders}
        openFolderAll={openFolderAll}
        currentFolder={currentFolder}
        itemLabel={itemLabel}
      />
    )
  } else {
    body = (
      <ListContentDetails
        {...taskHandlers}
        openCategory={openCategory}
        categories={categories}
        folders={folders}
        openFolderAll={openFolderAll}
        currentFolder={currentFolder}
      />
    )
  }

  return (
    <div className="fm-sunken">
      {uncategorizedFilter}
      {quickAdd}
      {!addingTaskToTarget && bulkAddPanel}
      {listFilter}
      {body}
    </div>
  )
}
