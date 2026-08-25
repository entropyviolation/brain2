"use client"

import { ItemSelectCheckbox, activateListItem } from "./item-select"
import type { ListContentChecklistProps } from "./types"

export type { ListContentChecklistProps } from "./types"

export function ListContentChecklist({
  tasks,
  onTaskSelect,
  onCompleteTask,
  onTaskDragStart,
  onDragEnd,
  selectMode,
  selectedTaskIds,
  onToggleTaskSelect,
}: ListContentChecklistProps) {
  const selected = new Set(selectedTaskIds)
  return (
    <div className="fm-linklist">
      {tasks.map((task) => (
        <div
          key={task.id}
          className={`fm-link-row${selectMode && selected.has(task.id) ? " selected" : ""}`}
          draggable={!selectMode}
          onDragStart={(e) => !selectMode && onTaskDragStart(e, task)}
          onDragEnd={onDragEnd}
          onClick={() => {
            if (selectMode) onToggleTaskSelect?.(task.id)
          }}
        >
          <ItemSelectCheckbox
            selectMode={selectMode}
            selected={selected.has(task.id)}
            label={task.description}
            onToggle={() => onToggleTaskSelect?.(task.id)}
          />
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
          <span
            className="fm-link-text"
            style={{ color: "#000", textDecoration: task.completed ? "line-through" : "none" }}
            onClick={(e) => {
              e.stopPropagation()
              activateListItem(selectMode, task.id, onToggleTaskSelect, onTaskSelect)
            }}
          >
            {task.description}
          </span>
        </div>
      ))}
    </div>
  )
}
