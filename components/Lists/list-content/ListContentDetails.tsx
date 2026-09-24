"use client"

import { useMemo } from "react"
import { formatAttributeValue, listAttributeSchema } from "@/components/Lists/attribute-editor"
import { itemTitle, listIsNextActions } from "@/lib/item-utils"
import { isFolderAllItemsCategoryId, isTaskUncategorizedGlobally, isTaskUncategorizedInFolder } from "@/lib/folder-all-items"
import { useItemTypeStore } from "@/lib/item-type-store"
import { useTaskStore } from "@/lib/task-store"
import {
  buildSpreadsheetCatalog,
  readBuiltinField,
  type SheetColumnCandidate,
} from "@/lib/spreadsheet-catalog"
import { resolveDetailsColumnIds } from "@/lib/details-columns"
import type { AttributeDefinition, Folder, List, Task } from "@/lib/types"
import type { ListContentDetailsProps } from "./types"
import { ListMissedButton } from "./ListMissedButton"

export type { ListContentDetailsProps } from "./types"

function listsColumnLabel(task: Task, categories: List[], currentFolder: Folder | null | undefined): string {
  const uncategorized = currentFolder
    ? isTaskUncategorizedInFolder(task, currentFolder)
    : isTaskUncategorizedGlobally(task)
  if (uncategorized) return "Uncategorized"
  return (
    (task.lists || [])
      .filter((cid) => !isFolderAllItemsCategoryId(cid))
      .map((cid) => categories.find((c) => c.id === cid)?.name)
      .filter(Boolean)
      .join(", ") || "—"
  )
}

function cellText(
  candidate: SheetColumnCandidate,
  task: Task,
  listNameById: Map<string, string>,
): string {
  if (candidate.source === "builtin" && candidate.builtin) {
    const raw = readBuiltinField(task, candidate.builtin, listNameById)
    if (candidate.def) return formatAttributeValue(candidate.def, raw) || "—"
    if (Array.isArray(raw)) return raw.join(", ") || "—"
    if (raw == null || raw === "") return "—"
    return String(raw)
  }
  if (candidate.def) return formatAttributeValue(candidate.def, task.attributes?.[candidate.id]) || "—"
  return "—"
}

interface DetailCol {
  key: string
  name: string
  render: (task: Task) => string
}

function buildDetailCols(
  columnIds: string[],
  catalogById: Map<string, SheetColumnCandidate>,
  attrDefs: AttributeDefinition[],
  listNameById: Map<string, string>,
  skipListsBuiltin: boolean,
): DetailCol[] {
  const cols: DetailCol[] = []
  for (const id of columnIds) {
    const candidate = catalogById.get(id)
    if (candidate) {
      if (skipListsBuiltin && candidate.builtin === "lists") continue
      cols.push({
        key: candidate.id,
        name: candidate.name,
        render: (task) => cellText(candidate, task, listNameById),
      })
      continue
    }
    const def = attrDefs.find((d) => d.id === id)
    if (def) {
      cols.push({
        key: def.id,
        name: def.name,
        render: (task) => formatAttributeValue(def, task.attributes?.[def.id]) || "—",
      })
    }
  }
  return cols
}

export function ListContentDetails({
  tasks,
  openCategory,
  categories,
  folders,
  openFolderAll,
  currentFolder,
  onTaskSelect,
  onCompleteTask,
  onMissedOpportunity,
  onTaskDragStart,
  onDragEnd,
  selectMode,
  selectedTaskIds,
  onToggleTaskSelect,
}: ListContentDetailsProps) {
  const types = useItemTypeStore((s) => s.types)
  const vaultItems = useTaskStore((s) => s.tasks)
  const selected = new Set(selectedTaskIds)
  const tableCat = openCategory
  const nextActions =
    (tableCat && listIsNextActions(tableCat.id, folders)) ||
    (openFolderAll && tasks.some((t) => listIsNextActions(t.lists?.[0] || "", folders)))

  const catalog = useMemo(
    () =>
      buildSpreadsheetCatalog({
        list: tableCat ?? undefined,
        lists: categories,
        types,
        listItems: tasks,
        vaultItems,
      }),
    [tableCat, categories, types, tasks, vaultItems],
  )

  const columnIds = resolveDetailsColumnIds(
    tableCat?.detailsColumns,
    catalog,
    tableCat ?? undefined,
    types,
    { nextActions: !!nextActions },
  )
  const attrDefs = tableCat ? listAttributeSchema(tableCat, types) : []
  const listNameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  )
  const cols = buildDetailCols(
    columnIds,
    new Map(catalog.map((c) => [c.id, c])),
    attrDefs,
    listNameById,
    openFolderAll,
  )

  return (
    <table className="fm-table">
      <thead>
        <tr>
          {selectMode && <th />}
          <th>✓</th>
          <th>Name</th>
          {openFolderAll && <th>Lists</th>}
          {cols.map((c) => (
            <th key={c.key}>{c.name}</th>
          ))}
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <tr
            key={task.id}
            className={selectMode && selected.has(task.id) ? "selected" : undefined}
            draggable={!selectMode}
            onDragStart={(e) => !selectMode && onTaskDragStart(e, task)}
            onDragEnd={onDragEnd}
            onClick={() => {
              if (selectMode) onToggleTaskSelect?.(task.id)
            }}
          >
            {selectMode && (
              <td onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selected.has(task.id)}
                  aria-label={`Select ${itemTitle(task)}`}
                  onChange={() => onToggleTaskSelect?.(task.id)}
                />
              </td>
            )}
            <td>
              <button
                className="fm-checkbox"
                onClick={(e) => {
                  e.stopPropagation()
                  onCompleteTask(task.id)
                }}
                aria-label="Complete"
              >
                {task.completed ? "✓" : ""}
              </button>
              <ListMissedButton task={task} onMissed={onMissedOpportunity} />
            </td>
            <td
              onClick={(e) => {
                e.stopPropagation()
                if (selectMode) onToggleTaskSelect?.(task.id)
                else onTaskSelect(task.id)
              }}
              style={{ cursor: "pointer" }}
            >
              {itemTitle(task)}
            </td>
            {openFolderAll && (
              <td className="text-xs">{listsColumnLabel(task, categories, currentFolder)}</td>
            )}
            {cols.map((c) => (
              <td key={c.key}>{c.render(task)}</td>
            ))}
            <td onClick={(e) => e.stopPropagation()}>
              <button
                className="fm-btn fm-btn-sm"
                disabled={!!selectMode}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!selectMode) onTaskSelect(task.id)
                }}
              >
                Open
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
