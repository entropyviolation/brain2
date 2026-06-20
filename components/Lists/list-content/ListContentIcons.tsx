"use client"

import { iconFor } from "@/components/Lists/lib/icon-utils"
import type { ListContentIconsProps } from "./types"

export type { ListContentIconsProps } from "./types"

export function ListContentIcons({
  tasks,
  onTaskSelect,
  onTaskDragStart,
  onDragEnd,
  onIconPickerOpen,
}: ListContentIconsProps) {
  return (
    <div className="fm-icon-grid">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="fm-icon"
          draggable
          onDragStart={(e) => onTaskDragStart(e, task)}
          onDragEnd={onDragEnd}
          onClick={() => onTaskSelect(task.id)}
          title={task.description}
        >
          <button
            className="fm-icon-edit"
            title="Change icon"
            onClick={(e) => {
              e.stopPropagation()
              onIconPickerOpen(task.id)
            }}
          >
            ✎
          </button>
          <div className="fm-icon-img-wrap">
            <img className="fm-icon-img" src={iconFor(task.id, task.icon)} alt="" draggable={false} />
          </div>
          <span className="fm-icon-label">{task.description}</span>
        </div>
      ))}
    </div>
  )
}
