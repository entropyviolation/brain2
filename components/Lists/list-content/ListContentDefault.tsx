"use client"

import { useMemo } from "react"
import { mergeListAttributes, listAttributeSchema, formatAttributeValue } from "@/components/Lists/attribute-editor"
import { iconFor } from "@/components/Lists/lib/icon-utils"
import { isMissed } from "@/lib/completion-status"
import { safeDateFormat } from "@/lib/date-utils"
import {
  descriptionSnippet,
  formatEstimateMinutes,
  resolveDefaultViewDensity,
  resolveDefaultViewExtraAttributeIds,
  resolveDefaultViewShow,
  sanitizeListDefaultView,
} from "@/lib/default-view-prefs"
import { getItemType } from "@/lib/item-types"
import { useItemTypeStore } from "@/lib/item-type-store"
import { itemTitle } from "@/lib/item-utils"
import type { AttributeDefinition, List, Task } from "@/lib/types"
import { ItemSelectCheckbox, activateListItem } from "./item-select"
import type { ListContentDefaultProps } from "./types"
import { useWindowedSlice } from "./use-windowed-slice"

export type { ListContentDefaultProps } from "./types"

function pipKind(task: Task): "open" | "done" | "missed" {
  if (isMissed(task)) return "missed"
  if (task.completed) return "done"
  return "open"
}

function typeLabel(task: Task, openCategory: List | null, types: Parameters<typeof getItemType>[0]): string {
  return getItemType(types, task.type ?? openCategory?.itemTypeId).name
}

function priorityBits(task: Task): string[] {
  const bits: string[] = []
  if (task.urgency != null) bits.push(`U${task.urgency}`)
  if (task.importance != null) bits.push(`I${task.importance}`)
  return bits
}

function otherListNames(task: Task, namesById: Map<string, string>, openCategory: List | null): string[] {
  const names: string[] = []
  for (const id of task.lists ?? []) {
    if (id === openCategory?.id) continue
    const name = namesById.get(id)
    if (name) names.push(name)
  }
  return names
}

function chipText(
  def: AttributeDefinition,
  task: Task,
): string {
  return formatAttributeValue(def, task.attributes?.[def.id])
}

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
  const prefs = sanitizeListDefaultView(openCategory?.defaultView)
  const show = resolveDefaultViewShow(prefs)
  const density = resolveDefaultViewDensity(prefs)
  const extraIds = resolveDefaultViewExtraAttributeIds(prefs)
  const extraSet = new Set(extraIds)
  const listNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const list of categories) {
      const name = list.name?.trim()
      if (name) map.set(list.id, name)
    }
    return map
  }, [categories])
  const rowPx = density === "compact" ? 28 : 40
  const { ref, start, end } = useWindowedSlice(tasks.length, rowPx)
  const visible = tasks.slice(start, end)

  return (
    <div
      ref={ref}
      className={`fm-readlist${density === "compact" ? " compact" : ""}`}
      data-testid="list-default-read"
      data-density={density}
    >
      {start > 0 ? <div style={{ height: start * rowPx }} aria-hidden /> : null}
      {visible.map((task) => {
        const defs = openCategory
          ? listAttributeSchema(openCategory, types)
          : mergeListAttributes(categories, task.lists, types)
        const itemDefs = [...defs, ...(task.itemAttributeDefinitions ?? [])]
        const byId = new Map<string, AttributeDefinition>()
        for (const d of itemDefs) {
          if (!byId.has(d.id)) byId.set(d.id, d)
        }
        const extraChips = extraIds
          .map((id) => {
            const d = byId.get(id)
            if (!d) return null
            const text = chipText(d, task)
            return text ? { d, text } : null
          })
          .filter((x): x is { d: AttributeDefinition; text: string } => Boolean(x))
        const autoChips = show.attributeChips
          ? defs
              .filter((d) => !extraSet.has(d.id))
              .map((d) => ({ d, text: chipText(d, task) }))
              .filter((x) => x.text)
              .slice(0, 3)
          : []
        const pip = pipKind(task)
        const bits = show.priority ? priorityBits(task) : []
        const tags = show.tags ? (task.tags ?? []).filter((t) => t.trim()) : []
        const lists = show.listNames ? otherListNames(task, listNameById, openCategory) : []
        const estimate = show.estimate ? formatEstimateMinutes(task.estimatedDuration) : ""
        const snippet = show.description ? descriptionSnippet(task) : ""
        const type = show.type ? typeLabel(task, openCategory, types) : ""
        const when = show.date && task.scheduledDate ? safeDateFormat(task.scheduledDate) : ""
        return (
          <div
            key={task.id}
            className={`fm-read-row${selectMode && selected.has(task.id) ? " selected" : ""}${task.completed ? " done" : ""}${pip === "missed" ? " missed" : ""}`}
            draggable={!selectMode}
            onDragStart={(e) => !selectMode && onTaskDragStart(e, task)}
            onDragEnd={onDragEnd}
            onClick={() => activateListItem(selectMode, task.id, onToggleTaskSelect, onTaskSelect)}
            title={itemTitle(task)}
          >
            <ItemSelectCheckbox
              selectMode={selectMode}
              selected={selected.has(task.id)}
              label={itemTitle(task)}
              onToggle={() => onToggleTaskSelect?.(task.id)}
            />
            {show.pip ? <span className={`fm-read-pip ${pip}`} data-pip={pip} aria-hidden /> : null}
            {show.orb ? (
              <img
                className="fm-read-orb"
                src={iconFor(task.id, task.icon)}
                alt=""
                draggable={false}
                loading="lazy"
                decoding="async"
              />
            ) : null}
            <span className={`fm-read-name${task.completed ? " done" : ""}`}>{itemTitle(task)}</span>
            <div className="fm-read-meta">
              {type ? <span className="fm-read-type">{type}</span> : null}
              {bits.map((bit) => (
                <span key={bit} className="fm-read-bit">
                  {bit}
                </span>
              ))}
              {when ? <span className="fm-read-when">{when}</span> : null}
              {estimate ? <span className="fm-read-est">{estimate}</span> : null}
              {snippet ? (
                <span className="fm-read-snippet" title={snippet}>
                  {snippet}
                </span>
              ) : null}
              {lists.length > 0 ? (
                <span className="fm-read-lists" title={lists.join(", ")}>
                  {lists.join(" · ")}
                </span>
              ) : null}
              {tags.map((tag) => (
                <span key={tag} className="fm-read-tag">
                  {tag}
                </span>
              ))}
              {extraChips.map(({ d, text }) => (
                <span key={`extra-${d.id}`} className="fm-attr-chip" data-attr-id={d.id} title={d.name}>
                  {text}
                </span>
              ))}
              {autoChips.map(({ d, text }) => (
                <span key={d.id} className="fm-attr-chip" title={d.name}>
                  {text}
                </span>
              ))}
            </div>
          </div>
        )
      })}
      {end < tasks.length ? <div style={{ height: (tasks.length - end) * rowPx }} aria-hidden /> : null}
    </div>
  )
}
