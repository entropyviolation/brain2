"use client"

import { mergeListAttributes, listAttributeSchema, formatAttributeValue } from "@/components/Lists/attribute-editor"
import { useItemTypeStore } from "@/lib/item-type-store"
import type { ListContentDefaultProps } from "./types"

export type { ListContentDefaultProps } from "./types"

export function ListContentDefault({
  tasks,
  openCategory,
  categories,
  onTaskSelect,
  onTaskDragStart,
  onDragEnd,
}: ListContentDefaultProps) {
  const types = useItemTypeStore((s) => s.types)
  return (
    <div className="fm-linklist">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="fm-link-row"
          draggable
          onDragStart={(e) => onTaskDragStart(e, task)}
          onDragEnd={onDragEnd}
          onClick={() => onTaskSelect(task.id)}
        >
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
