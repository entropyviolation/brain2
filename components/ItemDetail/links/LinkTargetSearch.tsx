/**
 * components/ItemDetail/links/LinkTargetSearch.tsx — Find the other item in
 * the Links composer (PD 6.2).
 *
 * Typeahead over every item: 20px orb, title, type plate, first list name.
 * Leaves out this item, items already linked here with the chosen relation,
 * and (when the relation is scoped with `toTypes`) items of other types.
 * ↑ ↓ move, Enter picks, Esc closes.
 */
"use client"

import { useId, useMemo, useState } from "react"
import { iconFor } from "@/components/Icons/Icon"
import type { LinkItemFacts } from "@/components/ItemDetail/links/link-items"
import type { Task } from "@/lib/types"

const LIMIT = 8

export function LinkTargetSearch({
  tasks,
  facts,
  selected,
  onSelect,
  excludeIds,
  toTypes,
}: {
  tasks: readonly Task[]
  facts: (task: Task) => LinkItemFacts
  selected: LinkItemFacts | null
  onSelect: (facts: LinkItemFacts | null) => void
  excludeIds: ReadonlySet<string>
  /** The relation's `toTypes`; absent = any type. */
  toTypes?: string[]
}) {
  const listId = useId()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const out: LinkItemFacts[] = []
    for (const task of tasks) {
      if (excludeIds.has(task.id)) continue
      const row = facts(task)
      if (!row.title.toLowerCase().includes(q)) continue
      if (toTypes?.length && !row.typeIds.some((id) => toTypes.includes(id))) continue
      out.push(row)
      if (out.length >= LIMIT) break
    }
    return out
  }, [query, tasks, facts, excludeIds, toTypes])

  const pick = (row: LinkItemFacts | undefined) => {
    if (!row) return
    onSelect(row)
    setQuery("")
    setOpen(false)
  }

  const shown = open && !selected && matches.length > 0

  return (
    <div className="rl-combo rl-target">
      <input
        type="text"
        role="combobox"
        aria-label="Search item to link"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        className="rl-field"
        placeholder="search…"
        value={selected ? selected.title : query}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          if (selected) onSelect(null)
          setQuery(event.target.value)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault()
            setActive((i) => Math.min(matches.length - 1, i + 1))
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            setActive((i) => Math.max(0, i - 1))
          } else if (event.key === "Enter" && shown) {
            event.preventDefault()
            pick(matches[active])
          } else if (event.key === "Escape" && shown) {
            event.stopPropagation()
            setOpen(false)
          }
        }}
      />
      {shown ? (
        <ul id={listId} role="listbox" className="rl-menu" aria-label="Items">
          {matches.map((row, i) => (
            <li
              key={row.id}
              role="option"
              aria-selected={i === active}
              className="rl-menu-row rl-target-row"
              data-active={i === active ? "true" : undefined}
              onMouseDown={(event) => {
                event.preventDefault()
                pick(row)
              }}
              onMouseEnter={() => setActive(i)}
            >
              <img className="rl-orb-20" data-orb src={iconFor(row.id, row.icon)} alt="" draggable={false} />
              <span className="rl-target-title">{row.title}</span>
              {row.typeName ? <span className="rl-typeplate">{row.typeName}</span> : null}
              {row.listName ? <span className="rl-target-list">{row.listName}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
