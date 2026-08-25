"use client"

import { mergeListAttributes, listAttributeSchema, formatAttributeValue } from "@/components/Lists/attribute-editor"
import { useItemTypeStore } from "@/lib/item-type-store"
import { ItemSelectCheckbox, activateListItem } from "./item-select"
import type { ListContentDefaultProps } from "./types"

export type { ListContentDefaultProps } from "./types"

export function ListContentDefault({
  tasks,
  openCategory,
  categories,
  onTaskSelect,
  onTaskDragStart,
  onDragEnd,
  selectMode,
  selectedTaskIds,
  onToggleTaskSelect,
}: ListContentDefaultProps) {
  const types = useItemTypeStore((s) => s.types)
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
          onClick={() => activateListItem(selectMode, task.id, onToggleTaskSelect, onTaskSelect)}
        >
          <ItemSelectCheckbox
            selectMode={selectMode}
            selected={selected.has(task.id)}
            label={task.description}
            onToggle={() => onToggleTaskSelect?.(task.id)}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
            <span className={`fm-link-text${task.completed ? " done" : ""}`}>{task.description}</span>
            {(() => {
              const defs = openCategory
                ? listAttributeSchema(openCategory, types)
                : mergeListAttributes(categories, task.lists, types)
              const chips = defs
                .map((d) => ({ d, text: formatAttributeValue(d, task.attributes?.[d.id]) }))
                .filter((x) => x.text)
              if (chips.length === 0) return null
              return (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {chips.map(({ d, text }) => (
                    <span key={d.id} className="fm-attr-chip" title={d.name}>
                      {text}
                    </span>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
      ))}
    </div>
  )
}
