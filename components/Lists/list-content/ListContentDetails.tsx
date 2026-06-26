"use client"

import { formatAttributeValue, listAttributeSchema } from "@/components/Lists/attribute-editor"
import { safeDateFormat } from "@/lib/date-utils"
import { listIsNextActions } from "@/lib/item-utils"
import { isFolderAllItemsCategoryId, isTaskUncategorizedInFolder } from "@/lib/folder-all-items"
import { useItemTypeStore } from "@/lib/item-type-store"
import type { ListContentDetailsProps } from "./types"

export type { ListContentDetailsProps } from "./types"

export function ListContentDetails({
  tasks,
  openCategory,
  categories,
  folders,
  openFolderAll,
  currentFolder,
  onTaskSelect,
  onCompleteTask,
  onTaskDragStart,
  onDragEnd,
}: ListContentDetailsProps) {
  const types = useItemTypeStore((s) => s.types)
  const tableCat = openCategory
  // Composed schema: the list's item type attributes + its list-specific extras.
  const attrDefs = tableCat ? listAttributeSchema(tableCat, types) : []
  const displayIds =
    tableCat?.displayedAttributes && tableCat.displayedAttributes.length > 0
      ? tableCat.displayedAttributes
      : attrDefs.map((d) => d.id)
  const cols = attrDefs.filter((d) => displayIds.includes(d.id))
  const showNextActionCols =
    (tableCat && listIsNextActions(tableCat.id, folders)) ||
    (openFolderAll && tasks.some((t) => listIsNextActions(t.lists?.[0] || "", folders)))

  return (
    <table className="fm-table">
      <thead>
        <tr>
          <th>✓</th>
          <th>Name</th>
          {openFolderAll && <th>Lists</th>}
          {cols.map((d) => (
            <th key={d.id}>{d.name}</th>
          ))}
          {showNextActionCols && (
            <>
              <th>Urgency</th>
              <th>Importance</th>
              <th>Scheduled</th>
            </>
          )}
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <tr key={task.id} draggable onDragStart={(e) => onTaskDragStart(e, task)} onDragEnd={onDragEnd}>
            <td>
              <button
                className="fm-checkbox"
                onClick={(e) => {
                  e.stopPropagation()
                  onCompleteTask(task.id)
                }}
              >
                {task.completed ? "✓" : ""}
              </button>
            </td>
            <td onClick={() => onTaskSelect(task.id)} style={{ cursor: "pointer" }}>
              {task.description}
            </td>
            {openFolderAll && currentFolder && (
              <td className="text-xs">
                {isTaskUncategorizedInFolder(task, currentFolder)
                  ? "Uncategorized"
                  : (task.lists || [])
                      .filter((cid) => !isFolderAllItemsCategoryId(cid))
                      .map((cid) => categories.find((c) => c.id === cid)?.name)
                      .filter(Boolean)
                      .join(", ") || "—"}
              </td>
            )}
            {cols.map((d) => (
              <td key={d.id}>{formatAttributeValue(d, task.attributes?.[d.id]) || "—"}</td>
            ))}
            {showNextActionCols && (
              <>
                <td>{task.urgency ?? "—"}</td>
                <td>{task.importance ?? "—"}</td>
                <td>{task.scheduledDate ? safeDateFormat(task.scheduledDate) : "—"}</td>
              </>
            )}
            <td>
              <button className="fm-btn fm-btn-sm" onClick={() => onTaskSelect(task.id)}>
                Open
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
