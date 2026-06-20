"use client"

import { Textarea } from "@/components/ui/textarea"
import { isScheduledFolderId } from "@/lib/scheduled-lists-sync"
import { ListContentDefault } from "./ListContentDefault"
import { ListContentChecklist } from "./ListContentChecklist"
import { ListContentIcons } from "./ListContentIcons"
import { ListContentDetails } from "./ListContentDetails"
import type { ListContentPanelProps } from "./types"

export type { ListContentPanelProps } from "./types"

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
}: ListContentPanelProps) {
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
  }

  if (tasks.length === 0) {
    return (
      <div className="fm-sunken">
        {uncategorizedFilter}
        {quickAdd}
        {!addingTaskToTarget && bulkAddPanel}
        <div className="fm-empty">
          <img src={openIconKey} alt="" style={{ width: 56, height: 56, opacity: 0.6 }} />
          <p>
            {folderAllUncategorizedOnly[currentFolder?.id || ""]
              ? "No uncategorized items in this folder."
              : openSmart
                ? "Nothing scheduled for this period."
                : `No active ${itemLabel.toLowerCase()}s in this list.`}
          </p>
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
      {body}
    </div>
  )
}
