"use client"

import { useState } from "react"
import { ClipboardCopy } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { itemTitle } from "@/lib/item-utils"
import { listIsReminders } from "@/lib/reminders"
import { isScheduledFolderId, isNaArchiveCategoryId, NA_SMART_MISSED } from "@/lib/scheduled-lists-sync"
import { ReminderQuickAdd } from "./reminder-quick-add"
import { ListContentDefault } from "./ListContentDefault"
import { ListContentChecklist } from "./ListContentChecklist"
import { ListContentDocuments } from "./ListContentDocuments"
import { ListContentGallery } from "./ListContentGallery"
import { ListContentIcons } from "./ListContentIcons"
import { ListContentIconsDesktop } from "./ListContentIconsDesktop"
import { ListContentDetails } from "./ListContentDetails"
import { ListContentSpreadsheet } from "./ListContentSpreadsheet"
import { ListSortControl } from "./ListSortControl"
import type { Task } from "@/lib/types"
import type { ListContentPanelProps } from "./types"

/** Bulk-add shape in list order, plus the names alone for Copy all. */
function plainTextList(tasks: Task[]): { view: string; names: string } {
  const names: string[] = []
  const lines: string[] = []
  let section: string | undefined
  for (const task of tasks) {
    const name = itemTitle(task)
    if (!name) continue
    names.push(name)
    const tag = (task.tags ?? []).map((t) => t.trim()).find(Boolean) ?? ""
    if (section !== tag) {
      if (lines.length) lines.push("")
      if (tag) lines.push(`${tag}:`)
      section = tag
    }
    lines.push(name)
  }
  return { view: lines.join("\n"), names: names.join("\n") }
}

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

/** Read-only bulk-add shape. Select any stretch; Copy all takes every name. */
function PlainTextListPanel({ view, names, onClose }: { view: string; names: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const copyAll = () => {
    const done = () => setCopied(true)
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(names).then(done).catch(done)
      return
    }
    done()
  }
  const lines = view ? view.split("\n").length : 1
  return (
    <div className="fm-quickadd" style={{ marginTop: 8 }}>
      <Textarea
        readOnly
        value={view}
        rows={Math.min(12, Math.max(3, lines))}
        aria-label="Plain text list"
      />
      <div className="flex gap-2">
        <button type="button" className="fm-btn fm-btn-sm" onClick={copyAll}>
          {copied ? "Copied" : "Copy all"}
        </button>
        <button type="button" className="fm-btn fm-btn-sm" onClick={onClose}>
          Close
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
  onAddMedia,
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
  sentThisWeek = false,
  showSent = false,
  onShowSentChange,
  iconsDesktop = false,
  listOrganizeEpoch = 0,
  listPileEpoch = 0,
  listGravityResetEpoch = 0,
  listGravitySettleEpoch = 0,
  sort,
  sortOptions,
  onSortChange,
  searchQuery = "",
}: ListContentPanelProps) {
  const [plainTextOpen, setPlainTextOpen] = useState(false)
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

  const reminders = listIsReminders(openCategory, categories)
  const quickAdd =
    allowAdd && addingTaskToTarget === openTargetKeyValue ? (
      reminders ? (
        <ReminderQuickAdd onCancel={onCancelAddTask} />
      ) : (
        <QuickAddPanel itemLabel={itemLabel} onAdd={onAddTask} onCancel={onCancelAddTask} />
      )
    ) : null

  const bulkAddPanel = allowAdd && showBulkAdd && !reminders ? (
    <BulkAddPanel itemLabel={itemLabel} onBulkAdd={onBulkAdd} onCancel={onBulkAddCancel} />
  ) : null

  const showSentControl = sentThisWeek ? (
    <button
      type="button"
      aria-pressed={showSent}
      onClick={() => onShowSentChange?.(!showSent)}
      style={{ fontSize: 11, color: "#8a8a8a", background: "none", border: "none", padding: "2px 4px", cursor: "pointer" }}
    >
      Show sent
    </button>
  ) : null

  const sortControl =
    currentDisplay === "default" && sortOptions && onSortChange && tasks.length > 0 ? (
      <ListSortControl sort={sort} options={sortOptions} onChange={onSortChange} />
    ) : null

  const showAdd = allowAdd && !addingTaskToTarget && !showBulkAdd
  const plainText = currentDisplay === "default" && tasks.length > 0 ? plainTextList(tasks) : null
  const plainTextButton = plainText?.names ? (
    <button
      type="button"
      className={`fm-btn fm-btn-sm${plainTextOpen ? " active" : ""}`}
      aria-label="Plain text list for copy paste"
      title="Plain text list for copy paste"
      aria-pressed={plainTextOpen}
      onClick={() => setPlainTextOpen((open) => !open)}
    >
      <ClipboardCopy size={14} aria-hidden />
    </button>
  ) : null
  const plainTextPanel = plainText && plainTextOpen ? (
    <PlainTextListPanel view={plainText.view} names={plainText.names} onClose={() => setPlainTextOpen(false)} />
  ) : null
  const addButtons =
    showAdd || sortControl || plainTextButton ? (
      <div className="fm-list-add-row">
        {showAdd && !reminders ? (
          <button className="fm-btn fm-btn-sm" onClick={() => onShowBulkAdd(true)}>
            Bulk add {itemLabel.toLowerCase()}s
          </button>
        ) : null}
        {showAdd ? (
          <button className="fm-btn fm-btn-sm" onClick={onShowAddTask}>
            Add {itemLabel}
          </button>
        ) : null}
        {plainTextButton}
        {showSentControl}
        {sortControl}
      </div>
    ) : (
      showSentControl
    )

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
  const emptyMessage = searchQuery.trim()
    ? `Nothing in this list matches “${searchQuery.trim()}”.`
    : uncategorizedOnlyChecked
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
        {plainTextPanel}
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
  } else if (currentDisplay === "icons" && iconsDesktop) {
    body = (
      <ListContentIconsDesktop
        {...taskHandlers}
        onIconPickerOpen={onIconPickerOpen}
        openTargetKey={openTargetKeyValue}
        organizeEpoch={listOrganizeEpoch}
        pileEpoch={listPileEpoch}
        gravityResetEpoch={listGravityResetEpoch}
        gravitySettleEpoch={listGravitySettleEpoch}
      />
    )
  } else if (currentDisplay === "icons") {
    body = <ListContentIcons {...taskHandlers} onIconPickerOpen={onIconPickerOpen} />
  } else if (currentDisplay === "gallery") {
    body = <ListContentGallery {...taskHandlers} onAddMedia={onAddMedia} />
  } else if (currentDisplay === "documents") {
    body = <ListContentDocuments {...taskHandlers} onAddMedia={onAddMedia} />
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

  const iconsDesk = currentDisplay === "icons" && iconsDesktop
  return (
    <div className={`fm-sunken${iconsDesk ? " fm-icons-desk" : ""}`}>
      {uncategorizedOnlyFilter}
      {quickAdd}
      {addButtons}
      {!addingTaskToTarget && bulkAddPanel}
      {plainTextPanel}
      {body}
    </div>
  )
}
