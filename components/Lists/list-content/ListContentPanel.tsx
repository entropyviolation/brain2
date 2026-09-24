"use client"

import { useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { isScheduledFolderId, isNaArchiveCategoryId, NA_SMART_MISSED } from "@/lib/scheduled-lists-sync"
import { ListContentDefault } from "./ListContentDefault"
import { ListContentChecklist } from "./ListContentChecklist"
import { ListContentIcons } from "./ListContentIcons"
import { ListContentDetails } from "./ListContentDetails"
import { ListContentSpreadsheet } from "./ListContentSpreadsheet"
import type { ListContentPanelProps } from "./types"

export type { ListContentPanelProps } from "./types"

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
  const submit = () => onAdd(text)
  return (
    <div className="fm-quickadd">
      <input
        className="fm-input"
        style={{ width: "100%" }}
        placeholder={`Enter ${itemLabel.toLowerCase()} description...`}
        aria-label={`New ${itemLabel.toLowerCase()} description`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            submit()
          }
        }}
        autoFocus
      />
      <div className="flex gap-2">
        <button className="fm-btn fm-btn-sm" onClick={submit}>
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
        placeholder={`Paste one ${itemLabel.toLowerCase()} per line. Optional tag headers end with ':' — Already have:\nfox statue\n\nplanned:\nholder`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
      />
      <p className="text-xs text-muted-foreground" style={{ marginTop: 4 }}>
        A line ending in <code>:</code> tags the items below it (existing tag if the name
        already exists). Plain lines stay untagged. Blank lines are ignored.
      </p>
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
  folderAllHideUncategorized = {},
  globalAllHiddenFolderIds = [],
  globalAllUncategorizedOnly = false,
  onGlobalAllUncategorizedOnlyChange,
  globalAllHideUncategorized = false,
  addingTaskToTarget,
  openTargetKeyValue,
  onAddTask,
  onCancelAddTask,
  onShowAddTask,
  showBulkAdd,
  onBulkAdd,
  onShowBulkAdd,
  onBulkAddCancel,
  onTaskSelect,
  onCompleteTask,
  onMissedOpportunity,
  onTaskDragStart,
  onDragEnd,
  onIconPickerOpen,
  selectMode,
  selectedTaskIds,
  onToggleTaskSelect,
  allowAdd = true,
}: ListContentPanelProps) {
  const hiddenForFolder = currentFolder ? folderAllHiddenListIds[currentFolder.id] ?? [] : []
  const hiddenGlobalFolders = globalAllHiddenFolderIds

  const uncategorizedOnlyChecked = isRootAll
    ? globalAllUncategorizedOnly
    : !!(currentFolder && folderAllUncategorizedOnly[currentFolder.id])
  const showUncategorizedOnlyFilter =
    openFolderAll && (isRootAll || (!!currentFolder && !isScheduledFolderId(currentFolder.id)))
  const uncategorizedOnlyFilter = showUncategorizedOnlyFilter ? (
    <div className="fm-toolbar" style={{ marginBottom: 6, padding: "4px 8px" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={uncategorizedOnlyChecked}
          onChange={(e) => {
            if (isRootAll) onGlobalAllUncategorizedOnlyChange?.(e.target.checked)
            else if (currentFolder) onFolderAllUncategorizedOnlyChange(currentFolder.id, e.target.checked)
          }}
        />
        Show uncategorized only
      </label>
    </div>
  ) : null

  const quickAdd =
    allowAdd && addingTaskToTarget === openTargetKeyValue ? (
      <QuickAddPanel itemLabel={itemLabel} onAdd={onAddTask} onCancel={onCancelAddTask} />
    ) : null

  const bulkAddPanel = allowAdd && showBulkAdd ? (
    <BulkAddPanel itemLabel={itemLabel} onBulkAdd={onBulkAdd} onCancel={onBulkAddCancel} />
  ) : null

  const addButtons =
    allowAdd && !addingTaskToTarget && !showBulkAdd ? (
      <div className="fm-list-add-row">
        <button className="fm-btn fm-btn-sm" onClick={() => onShowBulkAdd(true)}>
          Bulk add {itemLabel.toLowerCase()}s
        </button>
        <button className="fm-btn fm-btn-sm" onClick={onShowAddTask}>
          Add {itemLabel}
        </button>
      </div>
    ) : null

  const taskHandlers = {
    tasks,
    onTaskSelect,
    onCompleteTask,
    onMissedOpportunity,
    onTaskDragStart,
    onDragEnd,
    selectMode,
    selectedTaskIds,
    onToggleTaskSelect,
  }

  const hideUncategorized = isRootAll
    ? globalAllHideUncategorized
    : !!(currentFolder && folderAllHideUncategorized[currentFolder.id])
  const archiveId = openCategory?.id
  const emptyMessage = uncategorizedOnlyChecked
    ? isRootAll
      ? "No uncategorized items."
      : "No uncategorized items in this folder."
    : hiddenForFolder.length > 0 || (!isRootAll && hideUncategorized)
      ? "No items in the selected lists."
      : isRootAll && (hiddenGlobalFolders.length > 0 || hideUncategorized)
        ? "No items in the selected folders."
        : archiveId && isNaArchiveCategoryId(archiveId, categories)
          ? openCategory?.autoArchive === "missed" || archiveId === NA_SMART_MISSED
            ? "No missed opportunities yet."
            : "No completed tasks yet."
        : openSmart
          ? "Nothing scheduled for this period."
          : `No active ${itemLabel.toLowerCase()}s in this list.`

  if (tasks.length === 0) {
    return (
      <div className="fm-sunken">
        {uncategorizedOnlyFilter}
        {quickAdd}
        {addButtons}
        {!addingTaskToTarget && bulkAddPanel}
        <div className="fm-empty">
          <img src={openIconKey} alt="" style={{ width: 56, height: 56, opacity: 0.6 }} loading="lazy" decoding="async" />
          <p>{emptyMessage}</p>
        </div>
      </div>
    )
  }

  let body = null
  if (currentDisplay === "default") {
    body = (
      <ListContentDefault
        {...taskHandlers}
        openCategory={openCategory}
        categories={categories}
      />
    )
  } else if (currentDisplay === "checklist") {
    body = <ListContentChecklist {...taskHandlers} checkboxVars={openCategory?.checklistCheckboxVars} />
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
      {uncategorizedOnlyFilter}
      {quickAdd}
      {addButtons}
      {!addingTaskToTarget && bulkAddPanel}
      {body}
    </div>
  )
}
