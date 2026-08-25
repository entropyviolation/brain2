"use client"

import { iconFor } from "@/components/Lists/lib/icon-utils"
import { ItemSelectCheckbox, activateListItem } from "./item-select"
import type { ListContentIconsProps } from "./types"

export type { ListContentIconsProps } from "./types"

export function ListContentIcons({
  tasks,
  onTaskSelect,
  onTaskDragStart,
  onDragEnd,
  onIconPickerOpen,
  selectMode,
  selectedTaskIds,
  onToggleTaskSelect,
}: ListContentIconsProps) {
  const selected = new Set(selectedTaskIds)
  return (
    <div className="fm-icon-grid">
      {tasks.map((task) => (
        <div
          key={task.id}
          className={`fm-icon${selectMode && selected.has(task.id) ? " selected" : ""}`}
          draggable={!selectMode}
          onDragStart={(e) => !selectMode && onTaskDragStart(e, task)}
          onDragEnd={onDragEnd}
          onClick={() => activateListItem(selectMode, task.id, onToggleTaskSelect, onTaskSelect)}
          title={task.description}
        >
          <ItemSelectCheckbox
            selectMode={selectMode}
            selected={selected.has(task.id)}
            label={task.description}
            onToggle={() => onToggleTaskSelect?.(task.id)}
          />
          {!selectMode && (
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
          )}
          <div className="fm-icon-img-wrap">
            <img className="fm-icon-img" src={iconFor(task.id, task.icon)} alt="" draggable={false} loading="lazy" decoding="async" />
          </div>
          <span className="fm-icon-label">{task.description}</span>
        </div>
      ))}
    </div>
  )
}
