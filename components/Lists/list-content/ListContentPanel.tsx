"use client"

import { useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { isScheduledFolderId } from "@/lib/scheduled-lists-sync"
import { foldersInGlobalAllForFilter, listsInFolderForFilter } from "@/lib/folder-all-items"
import { isFolderHiddenFromGlobalAll } from "@/lib/module-lists"
import { ListContentDefault } from "./ListContentDefault"
import { ListContentChecklist } from "./ListContentChecklist"
import { ListContentIcons } from "./ListContentIcons"
import { ListContentDetails } from "./ListContentDetails"
import { ListContentSpreadsheet } from "./ListContentSpreadsheet"
import type { ListContentPanelProps } from "./types"

export type { ListContentPanelProps } from "./types"

function AllViewCheckboxFilter({
  items,
  hiddenIds,
  onHiddenChange,
  ariaLabel,
}: {
  items: { id: string; name: string }[]
  hiddenIds: string[]
  onHiddenChange: (id: string, hidden: boolean) => void
  ariaLabel: string
}) {
  if (items.length === 0) return null
  const hidden = new Set(hiddenIds)
  return (
    <div className="fm-list-filter" role="group" aria-label={ariaLabel}>
      {items.map((item) => (
        <label key={item.id} className="fm-list-filter-item">
          <input
            type="checkbox"
            checked={!hidden.has(item.id)}
            onChange={(e) => onHiddenChange(item.id, !e.target.checked)}
          />
          {item.name}
        </label>
      ))}
    </div>
  )
}

/** Owns its text so typing does not re-render the list board / item grid. */
function QuickAddPanel({
  itemLabel,
  onAdd,
  onCancel,
}: {
  itemLabel: string
  onAdd: (description: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState("")
  return (
    <div className="fm-quickadd">
      <Textarea
        placeholder={`Enter ${itemLabel.toLowerCase()} description...`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
      />
      <div className="flex gap-2">
        <button className="fm-btn fm-btn-sm" onClick={() => onAdd(text)}>
          Add {itemLabel}
        </button>
        <button className="fm-btn fm-btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

/** Owns its text so typing does not re-render the list board / item grid. */
function BulkAddPanel({
  itemLabel,
  onBulkAdd,
  onCancel,
}: {
  itemLabel: string
  onBulkAdd: (text: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState("")
  return (
    <div className="fm-quickadd" style={{ marginTop: 8 }}>
      <Textarea
        placeholder={`Paste one ${itemLabel.toLowerCase()} per line…`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
      />
      <div className="flex gap-2">
        <button className="fm-btn fm-btn-sm" onClick={() => onBulkAdd(text)}>
          Add all
        </button>
        <button className="fm-btn fm-btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
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
  isRootAll = false,
  itemLabel,
  openIconKey,
  folderAllUncategorizedOnly,
  onFolderAllUncategorizedOnlyChange,
  folderAllHiddenListIds,
  onFolderAllListHiddenChange,
  globalAllHiddenFolderIds = [],
  onGlobalAllFolderHiddenChange,
  globalAllUncategorizedOnly = false,
  onGlobalAllUncategorizedOnlyChange,
  addingTaskToTarget,
  openTargetKeyValue,
  onAddTask,
  onCancelAddTask,
  showBulkAdd,
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
    openFolderAll &&
    !isRootAll &&
    !!currentFolder &&
    !isScheduledFolderId(currentFolder.id)
  const folderFilterLists =
    showFolderAllListFilter && currentFolder ? listsInFolderForFilter(currentFolder, categories) : []
  const hiddenForFolder = currentFolder ? folderAllHiddenListIds[currentFolder.id] ?? [] : []

  const showGlobalAllFolderFilter = openFolderAll && isRootAll
  const globalFilterFolders = showGlobalAllFolderFilter
    ? foldersInGlobalAllForFilter(folders).filter((f) => !isFolderHiddenFromGlobalAll(f, folders))
    : []
  const hiddenGlobalFolders = globalAllHiddenFolderIds

  const uncategorizedChecked = isRootAll
    ? globalAllUncategorizedOnly
    : !!(currentFolder && folderAllUncategorizedOnly[currentFolder.id])
  const showUncategorizedFilter =
    openFolderAll && (isRootAll || (!!currentFolder && !isScheduledFolderId(currentFolder.id)))
  const uncategorizedFilter = showUncategorizedFilter ? (
    <div className="fm-toolbar" style={{ marginBottom: 6, padding: "4px 8px" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={uncategorizedChecked}
          onChange={(e) => {
            if (isRootAll) onGlobalAllUncategorizedOnlyChange?.(e.target.checked)
            else if (currentFolder) onFolderAllUncategorizedOnlyChange(currentFolder.id, e.target.checked)
          }}
        />
        Show uncategorized only
      </label>
    </div>
  ) : null

  const listFilter =
    showFolderAllListFilter && currentFolder ? (
      <AllViewCheckboxFilter
        items={folderFilterLists}
        hiddenIds={hiddenForFolder}
        onHiddenChange={(listId, hidden) => onFolderAllListHiddenChange(currentFolder.id, listId, hidden)}
        ariaLabel="Filter lists"
      />
    ) : showGlobalAllFolderFilter ? (
      <AllViewCheckboxFilter
        items={globalFilterFolders}
        hiddenIds={hiddenGlobalFolders}
        onHiddenChange={(folderId, hidden) => onGlobalAllFolderHiddenChange?.(folderId, hidden)}
        ariaLabel="Filter folders"
      />
    ) : null

  const quickAdd =
    addingTaskToTarget === openTargetKeyValue ? (
      <QuickAddPanel itemLabel={itemLabel} onAdd={onAddTask} onCancel={onCancelAddTask} />
    ) : null

  const bulkAddPanel = showBulkAdd ? (
    <BulkAddPanel itemLabel={itemLabel} onBulkAdd={onBulkAdd} onCancel={onBulkAddCancel} />
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

  const emptyMessage = isRootAll && globalAllUncategorizedOnly
    ? "No uncategorized items."
    : folderAllUncategorizedOnly[currentFolder?.id || ""]
    ? "No uncategorized items in this folder."
    : hiddenForFolder.length > 0
      ? "No items in the selected lists."
      : hiddenGlobalFolders.length > 0 && isRootAll
        ? "No items in the selected folders."
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
