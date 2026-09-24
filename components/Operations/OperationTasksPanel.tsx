/**
 * components/Operations/OperationTasksPanel.tsx — the operation's To do panel
 *
 * This is the Operations ↔ Lists bridge in the UI: it mounts the *real* Lists
 * content panel (`components/Lists/list-content/ListContentPanel`) over the
 * operation's backing `List` (`lib/operation-lists.ts`). Items added here are
 * ordinary tasks — they carry the operation's list membership (so they appear in
 * the Lists tab, All Items, and search) and a `has-part` link to the operation
 * (so they feed its progress bar and the Queue rail). Steps from phases and
 * stage/finish tasks from parts are filed onto the same list.
 *
 * Display mode (default / checklist / table / spreadsheet) is remembered per
 * list in `lib/lists-ui-store.ts`, exactly like the Lists tab.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { ListContentPanel } from "@/components/Lists/list-content/ListContentPanel"
import { iconFor } from "@/components/Icons/Icon"
import { useTaskStore } from "@/lib/task-store"
import { useListsUiStore, type ListDisplay } from "@/lib/lists-ui-store"
import {
  OPERATIONS_FOLDER_ID,
  ensureOperationTaskList,
  findOperationTaskList,
} from "@/lib/operation-lists"
import { collectOperationTodoTasks } from "@/lib/operation-parts"
import { parseListBulkAddText } from "@/lib/smart-parse"
import { sanitizeEnabledDisplays, type Task } from "@/lib/types"
import { addOperationListTask, addOperationListTasks, fileLooseOperationTodos, setTaskCompleted } from "./operation-actions"
import "@/components/Lists/filemanager98.css"

const FALLBACK_DISPLAYS: ListDisplay[] = ["default", "checklist", "table", "spreadsheet"]

export function OperationTasksPanel({
  operation,
  onOpenItem,
}: {
  operation: Task
  onOpenItem?: (id: string) => void
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const folders = useTaskStore((s) => s.folders)
  const listDisplay = useListsUiStore((s) => s.listDisplay)
  const setListDisplay = useListsUiStore((s) => s.setListDisplay)

  const [adding, setAdding] = useState(false)
  const [showBulkAdd, setShowBulkAdd] = useState(false)

  const list = useMemo(() => findOperationTaskList(operation, lists), [operation, lists])

  useEffect(() => {
    ensureOperationTaskList(operation.id)
    fileLooseOperationTodos(operation.id)
  }, [operation.id])

  const items = useMemo(
    () =>
      collectOperationTodoTasks(operation.id, tasks, list?.id ?? null).filter((t) => !t.completed),
    [operation.id, list, tasks],
  )

  if (!list) return <p className="ops-hint py-8 text-center">Setting up the operation list…</p>

  const displays = sanitizeEnabledDisplays(list.enabledDisplays) ?? FALLBACK_DISPLAYS
  const stored = listDisplay[list.id]
  const currentDisplay: ListDisplay = stored && displays.includes(stored) ? stored : displays[0]
  const folder = folders.find((f) => f.id === OPERATIONS_FOLDER_ID)

  return (
    <div className="ops-deck">
      <div className="ops-deck-head">
        <span>To do</span>
        <span className="ops-deck-tools">
          <label className="ops-inline-label" htmlFor="op-tasks-display">
            View
          </label>
          <select
            id="op-tasks-display"
            className="ops-input ops-input-sm"
            value={currentDisplay}
            onChange={(e) => setListDisplay(list.id, e.target.value as ListDisplay)}
          >
            {displays.map((mode) => (
              <option key={mode} value={mode}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </option>
            ))}
          </select>
        </span>
      </div>

      <p className="ops-hint">
        Every task for this operation, including steps from phases and parts. Ideas stay on
        their part. Items live in the <strong>{list.name}</strong> list, so they show up in
        Lists and search too.
      </p>

      <div className="ops-listhost">
        <ListContentPanel
          tasks={items}
          currentDisplay={currentDisplay}
          categories={lists}
          folders={folders}
          openCategory={list}
          openFolderAll={false}
          openSmart={false}
          currentFolder={folder}
          itemLabel={list.itemLabel ?? "task"}
          openIconKey={iconFor(list.id, list.icon)}
          folderAllUncategorizedOnly={{}}
          onFolderAllUncategorizedOnlyChange={() => {}}
          folderAllHiddenListIds={{}}
          addingTaskToTarget={adding ? list.id : null}
          openTargetKeyValue={list.id}
          onAddTask={(description) => {
            if (description.trim()) addOperationListTask(operation.id, description)
            setAdding(false)
          }}
          onCancelAddTask={() => setAdding(false)}
          onShowAddTask={() => setAdding(true)}
          showBulkAdd={showBulkAdd}
          onBulkAdd={(text) => {
            addOperationListTasks(operation.id, parseListBulkAddText(text))
            setShowBulkAdd(false)
          }}
          onShowBulkAdd={setShowBulkAdd}
          onBulkAddCancel={() => setShowBulkAdd(false)}
          onTaskSelect={(id) => onOpenItem?.(id)}
          onCompleteTask={(id) => setTaskCompleted(id, true)}
          onTaskDragStart={() => {}}
          onDragEnd={() => {}}
          onIconPickerOpen={() => {}}
        />
      </div>
    </div>
  )
}

export default OperationTasksPanel
