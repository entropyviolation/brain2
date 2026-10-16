/**
 * components/ItemDetail/links/LinkTargetSearch.tsx — Find the item to link
 *
 * Typeahead over every item: title, full name, nicknames, description.
 * Rows show the orb, the title, the type, and the first list. A relation
 * made for certain types only offers those. When a relation points at
 * people and nobody matches, "New person" adds one to People I Know.
 */
"use client"

import { useMemo, useState } from "react"
import { UserPlus } from "lucide-react"
import { iconFor } from "@/components/Icons/Icon"
import { itemLinkTypeId } from "@/lib/item-types"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { useItemTypeStore } from "@/lib/item-type-store"
import { createPerson, ensurePeopleIKnowList } from "@/lib/people-i-know"
import { PERSON_TYPE_ID } from "@/lib/person-types"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"

interface LinkTargetSearchProps {
  sourceId: string
  toTypes?: string[]
  excludeIds: string[]
  value: string | null
  onChange: (id: string | null) => void
  onEnter: (id: string) => void
}

function haystack(task: Task): string {
  const profile = task.personProfile
  return [itemTitleOrUntitled(task), profile?.fullName, ...(profile?.nicknames ?? []), task.taskDescription]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

export function LinkTargetSearch({ sourceId, toTypes, excludeIds, value, onChange, onEnter }: LinkTargetSearchProps) {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const addTask = useTaskStore((s) => s.addTask)
  const types = useItemTypeStore((s) => s.types)
  const [query, setQuery] = useState("")
  const [focused, setFocused] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const q = query.trim().toLowerCase()

  const matches = useMemo(() => {
    if (!q) return []
    const skip = new Set([sourceId, ...excludeIds])
    const out: Task[] = []
    for (const task of tasks) {
      if (skip.has(task.id)) continue
      if (toTypes?.length && !toTypes.includes(itemLinkTypeId(task, lists))) continue
      if (!haystack(task).includes(q)) continue
      out.push(task)
      if (out.length >= 8) break
    }
    return out
  }, [q, tasks, lists, sourceId, excludeIds, toTypes])

  const offersPerson =
    !!q && toTypes?.includes(PERSON_TYPE_ID) === true && !matches.some((task) => itemTitleOrUntitled(task).toLowerCase() === q)
  const total = matches.length + (offersPerson ? 1 : 0)
  const picked = value ? tasks.find((task) => task.id === value) : undefined

  const pick = (index: number) => {
    let id: string | undefined
    if (index < matches.length) id = matches[index].id
    else if (offersPerson) {
      const person = createPerson(query.trim(), ensurePeopleIKnowList())
      addTask(person)
      id = person.id
    }
    if (!id) return
    onChange(id)
    setQuery("")
    return id
  }

  const typeName = (task: Task) => {
    const id = itemLinkTypeId(task, lists)
    return types.find((type) => type.id === id)?.name ?? id
  }
  const listName = (task: Task) => lists.find((list) => list.id === task.lists?.[0])?.name

  return (
    <div className="rl-field">
      <input
        type="text"
        role="combobox"
        aria-expanded={focused && total > 0}
        aria-label="Search item to link"
        placeholder="Search item to link…"
        value={picked ? itemTitleOrUntitled(picked) : query}
        onChange={(event) => {
          onChange(null)
          setQuery(event.target.value)
          setHighlight(0)
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault()
            setHighlight((h) => Math.min(total - 1, h + 1))
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            setHighlight((h) => Math.max(0, h - 1))
          } else if (event.key === "Enter") {
            event.preventDefault()
            if (value) onEnter(value)
            else if (total > 0) {
              const id = pick(highlight)
              if (id) onEnter(id)
            }
          }
        }}
      />
      {focused && !value && total > 0 ? (
        <div className="rl-menu" role="listbox" aria-label="Items">
          {matches.map((task, index) => (
            <button
              key={task.id}
              type="button"
              role="option"
              aria-selected={false}
              className="rl-menu-row"
              data-highlight={index === highlight}
              onMouseDown={(event) => {
                event.preventDefault()
                pick(index)
              }}
            >
              <img src={iconFor(task.id, task.icon)} alt="" data-orb />
              <span className="truncate">{itemTitleOrUntitled(task)}</span>
              <span className="rl-menu-meta">
                {typeName(task)}
                {listName(task) ? ` · ${listName(task)}` : ""}
              </span>
            </button>
          ))}
          {offersPerson ? (
            <button
              type="button"
              role="option"
              aria-selected={false}
              className="rl-menu-row"
              data-highlight={highlight === matches.length}
              onMouseDown={(event) => {
                event.preventDefault()
                pick(matches.length)
              }}
            >
              <UserPlus className="h-4 w-4" aria-hidden />
              New person “{query.trim()}”
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
