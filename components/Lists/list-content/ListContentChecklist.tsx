"use client"

import type { ListContentChecklistProps } from "./types"

export type { ListContentChecklistProps } from "./types"

export function ListContentChecklist({
  tasks,
  onTaskSelect,
  onCompleteTask,
  onTaskDragStart,
  onDragEnd,
}: ListContentChecklistProps) {
  return (
    <div className="fm-linklist">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="fm-link-row"
          draggable
          onDragStart={(e) => onTaskDragStart(e, task)}
          onDragEnd={onDragEnd}
        >
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
            onClick={() => onTaskSelect(task.id)}
          >
            {task.description}
          </span>
        </div>
      ))}
    </div>
  )
}
