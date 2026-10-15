/**
 * components/Home/Plan/event-prereq-picker.tsx — Event prerequisite checklist
 *
 * The “must be done before” list on Edit Event. Linked items show as rows with
 * their Lists orb/trinket (`iconFor`), a done mark, and a remove key. Below,
 * one search box over every open item (title + description, ranked, capped so
 * thousands of items stay fast) in an in-flow sunken well — not a native
 * select that spills outside the dialog. Enter or the last row creates a new
 * item with the typed name and links it.
 */
"use client"

import { useId, useMemo, useState } from "react"
import type { Task } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { itemTitle } from "@/lib/item-utils"
import { iconFor } from "@/components/Icons"
import { HabitGemImg } from "@/components/Home/Habits/habit-gems"

const RESULT_LIMIT = 40

function Orb({ task }: { task: Task }) {
  return <HabitGemImg src={iconFor(task.id, task.icon)} className="plan-prereq-orb" width={16} height={16} />
}

/** Rank: title starts with the query, then a word starts with it, then contains, then body only. */
function rankMatch(title: string, body: string, needle: string): number {
  if (title.startsWith(needle)) return 0
  if (title.includes(` ${needle}`)) return 1
  if (title.includes(needle)) return 2
  if (body.includes(needle)) return 3
  return -1
}

export function EventPrereqPicker({
  inputId,
  linked,
  candidates,
  onAttach,
  onDetach,
  onCreate,
}: {
  inputId?: string
  /** Items already on this event's checklist. */
  linked: Task[]
  /** Items that may be added (open, not already linked). */
  candidates: Task[]
  onAttach: (taskId: string) => void
  onDetach: (taskId: string) => void
  onCreate: (title: string) => void
}) {
  const listId = useId()
  const lists = useTaskStore((s) => s.lists)
  const [query, setQuery] = useState("")
  const [highlight, setHighlight] = useState(0)

  const listNames = useMemo(() => new Map(lists.map((l) => [l.id, l.name])), [lists])
  const needle = query.trim().toLowerCase()

  const { hits, total } = useMemo(() => {
    if (!needle) return { hits: [] as Task[], total: 0 }
    const scored: { task: Task; rank: number; title: string }[] = []
    for (const task of candidates) {
      const title = itemTitle(task).toLowerCase()
      const body = (task.taskDescription ?? "").toLowerCase()
      const rank = rankMatch(title, body, needle)
      if (rank >= 0) scored.push({ task, rank, title })
    }
    scored.sort((a, b) => a.rank - b.rank || a.title.length - b.title.length || a.title.localeCompare(b.title))
    return { hits: scored.slice(0, RESULT_LIMIT).map((s) => s.task), total: scored.length }
  }, [candidates, needle])

  const exact = needle ? [...candidates, ...linked].some((t) => itemTitle(t).trim().toLowerCase() === needle) : false
  const canCreate = needle.length > 0 && !exact
  const rowCount = hits.length + (canCreate ? 1 : 0)

  const reset = () => {
    setQuery("")
    setHighlight(0)
  }

  const attach = (taskId: string) => {
    onAttach(taskId)
    reset()
  }

  const create = () => {
    const title = query.trim()
    if (!title) return
    onCreate(title)
    reset()
  }

  const choose = (index: number) => {
    if (index < hits.length) attach(hits[index]!.id)
    else if (canCreate) create()
  }

  const listLabel = (task: Task) =>
    (task.lists ?? [])
      .map((id) => listNames.get(id))
      .filter(Boolean)
      .slice(0, 2)
      .join(", ")

  const done = linked.filter((t) => t.completed).length

  return (
    <div className="plan-prereq">
      {linked.length > 0 ? (
        <ul className="plan-prereq-linked" aria-label="Linked prerequisites">
          {linked.map((task) => (
            <li key={task.id} className="plan-prereq-item" data-done={task.completed ? "true" : undefined}>
              <span className="plan-prereq-check" aria-label={task.completed ? "Done" : "Not done"}>
                {task.completed ? "✓" : ""}
              </span>
              <Orb task={task} />
              <span className="plan-prereq-title">{itemTitle(task)}</span>
              <button
                type="button"
                data-plan-pick=""
                className="plan-prereq-remove b2-close-key"
                onClick={() => onDetach(task.id)}
                aria-label={`Remove ${itemTitle(task)} from checklist`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="plan-prereq-empty">No prerequisite tasks linked yet.</p>
      )}
      {linked.length > 0 ? (
        <p className="plan-prereq-count">
          {done}/{linked.length} done
        </p>
      ) : null}

      <input
        id={inputId}
        type="search"
        className="plan-prereq-search"
        value={query}
        placeholder="Search items, or type a new one…"
        aria-label="Search prerequisite items"
        autoComplete="off"
        role="combobox"
        aria-expanded={rowCount > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          setQuery(e.target.value)
          setHighlight(0)
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setHighlight((h) => Math.min(h + 1, Math.max(0, rowCount - 1)))
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setHighlight((h) => Math.max(h - 1, 0))
          } else if (e.key === "Enter") {
            e.preventDefault()
            if (rowCount > 0) choose(Math.min(highlight, rowCount - 1))
          } else if (e.key === "Escape" && query) {
            e.stopPropagation()
            reset()
          }
        }}
      />

      {needle ? (
        <ul id={listId} className="plan-prereq-results" role="listbox" aria-label="Matching items">
          {hits.map((task, i) => {
            const where = listLabel(task)
            return (
              <li key={task.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  data-plan-pick=""
                  data-no95=""
                  className="plan-prereq-row"
                  aria-selected={i === highlight}
                  data-active={i === highlight ? "true" : undefined}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => attach(task.id)}
                >
                  <Orb task={task} />
                  <span className="plan-prereq-title">{itemTitle(task)}</span>
                  {where ? <span className="plan-prereq-where">{where}</span> : null}
                </button>
              </li>
            )
          })}
          {total > hits.length ? (
            <li role="presentation" className="plan-prereq-more">
              {total - hits.length} more — keep typing to narrow
            </li>
          ) : null}
          {hits.length === 0 && !canCreate ? (
            <li role="presentation" className="plan-prereq-more">
              Already linked.
            </li>
          ) : null}
          {canCreate ? (
            <li role="presentation">
              <button
                type="button"
                role="option"
                data-plan-pick=""
                data-no95=""
                className="plan-prereq-row plan-prereq-create"
                aria-selected={highlight === hits.length}
                data-active={highlight === hits.length ? "true" : undefined}
                onMouseEnter={() => setHighlight(hits.length)}
                onClick={create}
              >
                <span className="plan-prereq-plus" aria-hidden>
                  +
                </span>
                <span className="plan-prereq-title">Create “{query.trim()}”</span>
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
