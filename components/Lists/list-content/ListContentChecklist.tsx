"use client"

import { ItemSelectCheckbox, activateListItem } from "./item-select"
import { ListMissedButton } from "./ListMissedButton"
import type { ListContentChecklistProps } from "./types"
import { itemTitle } from "@/lib/item-utils"
import {
  CHECKLIST_CHECKBOX_LABELS,
  checklistHasVar,
  sanitizeChecklistCheckboxVars,
} from "@/lib/checklist-checkbox-vars"

export type { ListContentChecklistProps } from "./types"

export function ListContentChecklist({
  tasks,
  onTaskSelect,
  onCompleteTask,
  onMissedOpportunity,
  onTaskDragStart,
  onDragEnd,
  selectMode,
  selectedTaskIds,
  onToggleTaskSelect,
  checkboxVars,
}: ListContentChecklistProps) {
  const selected = new Set(selectedTaskIds)
  const vars = sanitizeChecklistCheckboxVars(checkboxVars)
  const showMissed = checklistHasVar(vars, "missed") && !!onMissedOpportunity
  const checkCols = `repeat(${showMissed ? 2 : 1}, minmax(4.6rem, auto))`
  const gridTemplate = `${selectMode ? "18px " : ""}${checkCols} minmax(0, 1fr)`

  return (
    <div className="fm-linklist fm-checklist">
      <div className="fm-link-row fm-check-head" style={{ gridTemplateColumns: gridTemplate }} aria-hidden={false}>
        {selectMode && <span className="fm-check-head-spacer" />}
        <span className="fm-check-head-col">{CHECKLIST_CHECKBOX_LABELS.completed}</span>
        {showMissed && <span className="fm-check-head-col">{CHECKLIST_CHECKBOX_LABELS.missed}</span>}
        <span className="fm-check-head-rest" />
      </div>
      {tasks.map((task) => (
        <div
          key={task.id}
          className={`fm-link-row${selectMode && selected.has(task.id) ? " selected" : ""}`}
          style={{ gridTemplateColumns: gridTemplate }}
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
            label={itemTitle(task)}
            onToggle={() => onToggleTaskSelect?.(task.id)}
          />
          <button
            className="fm-checkbox"
            onClick={(e) => {
              e.stopPropagation()
              onCompleteTask(task.id)
            }}
            aria-label="Completed"
            title="Completed"
          >
            {task.completed ? "✓" : ""}
          </button>
          {showMissed && <ListMissedButton task={task} onMissed={onMissedOpportunity} />}
          <span
            className="fm-link-text"
            style={{ color: "#000", textDecoration: task.completed ? "line-through" : "none" }}
            onClick={(e) => {
              e.stopPropagation()
              activateListItem(selectMode, task.id, onToggleTaskSelect, onTaskSelect)
            }}
          >
            {itemTitle(task)}
          </span>
        </div>
      ))}
    </div>
  )
}
