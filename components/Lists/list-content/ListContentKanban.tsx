/**
 * components/Lists/list-content/ListContentKanban.tsx — Kanban display mode
 *
 * The Lists "Kanban" display: items laid out as cards in columns derived from a
 * chosen selection/status attribute (Feature 6). The status attribute is picked
 * per-list (persisted in `lib/lists-ui-store`); columns come from that
 * attribute's options plus any values present on items, with a trailing backlog
 * column for unset items. Cards can be **dragged** between columns or moved with
 * the ◀ ▶ buttons; either way the attribute value is written back via the task
 * store's `updateTask`. Honors the Win95 File Manager skin (`filemanager98.css`).
 */
"use client"

import { useMemo, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { useListsUiStore } from "@/lib/lists-ui-store"
import { formatAttributeValue } from "@/components/Lists/attribute-editor"
import type { AttributeDefinition } from "@/lib/types"
import {
  KANBAN_BACKLOG,
  deriveKanbanColumns,
  isKanbanGroupable,
  statusValueToWrite,
} from "./kanban-utils"
import type { ListContentTaskHandlers } from "./types"

const KANBAN_DND_TYPE = "application/x-cogs-kanban-task"

export interface ListContentKanbanProps extends ListContentTaskHandlers {
  /** The opened list; supplies the attribute schema for column choices. */
  openCategory: { id: string; itemAttributes?: AttributeDefinition[] } | null
  /** Stable per-list key (matches `openTargetKey`) for storing the status attr. */
  listKey: string
}

export function ListContentKanban({ tasks, openCategory, listKey, onTaskSelect }: ListContentKanbanProps) {
  const updateTask = useTaskStore((s) => s.updateTask)
  const kanbanStatusAttrId = useListsUiStore((s) => s.kanbanStatusAttrId)
  const setKanbanStatusAttrId = useListsUiStore((s) => s.setKanbanStatusAttrId)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const groupable = useMemo(
    () => (openCategory?.itemAttributes ?? []).filter(isKanbanGroupable),
    [openCategory],
  )

  const selectedId = kanbanStatusAttrId[listKey] || groupable[0]?.id || ""
  const def = useMemo(() => groupable.find((d) => d.id === selectedId), [groupable, selectedId])

  const columns = useMemo(() => deriveKanbanColumns(tasks, def), [tasks, def])
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])

  const moveTask = (taskId: string, columnKey: string) => {
    const task = taskById.get(taskId)
    if (!task || !def) return
    const next = statusValueToWrite(def, columnKey)
    const attributes = { ...(task.attributes ?? {}) }
    if (next === undefined) delete attributes[def.id]
    else attributes[def.id] = next
    updateTask({ ...task, attributes })
  }

  if (groupable.length === 0) {
    return (
      <div className="fm-empty">
        <p>
          Add a selection or text attribute to this list (e.g. a "Status" field) to use the Kanban
          board.
        </p>
      </div>
    )
  }

  if (!def) {
    return (
      <div className="fm-empty">
        <p>Pick a status attribute for the board.</p>
      </div>
    )
  }

  const columnIndex = (key: string) => columns.findIndex((c) => c.key === key)
  const shift = (taskId: string, fromKey: string, dir: -1 | 1) => {
    const i = columnIndex(fromKey)
    const target = columns[i + dir]
    if (target) moveTask(taskId, target.key)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 0 }}>
      <div className="fm-toolbar" style={{ gap: 6 }}>
        <span style={{ fontSize: 11 }}>Columns by:</span>
        <select
          className="fm-select"
          value={selectedId}
          onChange={(e) => setKanbanStatusAttrId(listKey, e.target.value)}
          style={{ fontSize: 11 }}
        >
          {groupable.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 8, overflowX: "auto", alignItems: "flex-start", paddingBottom: 4 }}>
        {columns.map((col) => (
          <div
            key={col.key}
            className={`fm-sunken${dragOver === col.key ? " fm-kanban-dragover" : ""}`}
            style={{
              minWidth: 180,
              maxWidth: 240,
              flex: "0 0 auto",
              padding: 6,
              outline: dragOver === col.key ? "2px dashed var(--fm-button-shadow, #808080)" : "none",
            }}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes(KANBAN_DND_TYPE)) {
                e.preventDefault()
                setDragOver(col.key)
              }
            }}
            onDragLeave={() => setDragOver((k) => (k === col.key ? null : k))}
            onDrop={(e) => {
              const id = e.dataTransfer.getData(KANBAN_DND_TYPE)
              setDragOver(null)
              if (id) {
                e.preventDefault()
                moveTask(id, col.key)
              }
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 11,
                fontWeight: "bold",
                marginBottom: 4,
                padding: "1px 2px",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {col.key === KANBAN_BACKLOG ? col.label : formatAttributeValue(def, col.key) || col.label}
              </span>
              <span style={{ color: "var(--fm-button-shadow, #808080)" }}>{col.taskIds.length}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {col.taskIds.map((id) => {
                const task = taskById.get(id)
                if (!task) return null
                const i = columnIndex(col.key)
                return (
                  <div
                    key={id}
                    className="fm-card"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(KANBAN_DND_TYPE, id)
                      e.dataTransfer.effectAllowed = "move"
                    }}
                    style={{
                      border: "1px solid var(--fm-button-shadow, #808080)",
                      background: "var(--fm-window, #fff)",
                      padding: 4,
                      cursor: "grab",
                      display: "flex",
                      flexDirection: "column",
                      gap: 3,
                    }}
                  >
                    <button
                      className="fm-link-text"
                      style={{
                        textAlign: "left",
                        color: "#000",
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        textDecoration: task.completed ? "line-through" : "none",
                      }}
                      onClick={() => onTaskSelect(id)}
                    >
                      {task.description}
                    </button>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
                      <button
                        className="fm-btn fm-btn-sm"
                        title="Move left"
                        disabled={i <= 0}
                        onClick={() => shift(id, col.key, -1)}
                      >
                        ◀
                      </button>
                      <button
                        className="fm-btn fm-btn-sm"
                        title="Move right"
                        disabled={i >= columns.length - 1}
                        onClick={() => shift(id, col.key, 1)}
                      >
                        ▶
                      </button>
                    </div>
                  </div>
                )
              })}
              {col.taskIds.length === 0 && (
                <div style={{ fontSize: 10, color: "var(--fm-button-shadow, #808080)", padding: 4 }}>
                  Drop here
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
