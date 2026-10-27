/**
 * components/Home/ToDo/ranges/TodoRangeSheet.tsx — Other view: a named "done before" range
 *
 * Load a range, edit its name and dates, open its List, add tasks. Tasks on
 * the range's List show here; new ones get the range end as their deadline.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import type { Task } from "@/lib/types"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import { NativeSelect } from "@/components/ui/native-select"
import { formatLocalDateKey } from "@/lib/date-utils"
import { setTodoPrefs, useTodoPrefs, type TodoRange } from "../todo-prefs"
import {
  createTodoRange,
  deleteTodoRange,
  openTodoRangeList,
  rangeEndDate,
  syncRangeDeadlines,
  tasksInRange,
  updateTodoRange,
} from "./todo-ranges"
import { createScheduledTodoTask } from "../todo-utils"

const DAY = 86_400_000

function daysUntil(end: string, now = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((rangeEndDate({ id: "", end }).setHours(0, 0, 0, 0) - today) / DAY)
}

function defaultEnd(): string {
  return formatLocalDateKey(new Date(Date.now() + 14 * DAY))
}

/** Live ranges: prefs rows whose List still exists, named from the List. */
export function useTodoRanges(): { range: TodoRange; name: string }[] {
  const { ranges } = useTodoPrefs()
  const lists = useTaskStore((s) => s.lists)
  return useMemo(
    () =>
      ranges.flatMap((range) => {
        const list = lists.find((l) => l.id === range.id)
        return list ? [{ range, name: list.name }] : []
      }),
    [ranges, lists],
  )
}

function NewRangeForm({ onDone }: { onDone?: () => void }) {
  const [name, setName] = useState("")
  const [end, setEnd] = useState(defaultEnd)
  const submit = () => {
    if (!name.trim() || !end) return
    createTodoRange(name, end)
    setName("")
    onDone?.()
  }
  return (
    <div className="todo-range-new" role="group" aria-label="New range">
      <label className="todo-inline-field">
        <span className="todo-label">Before</span>
        <input
          className="todo-range-name-input"
          value={name}
          placeholder="Elijah gets back, album release…"
          aria-label="Range name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </label>
      <label className="todo-inline-field">
        <span className="todo-label">Done by</span>
        <input type="date" value={end} aria-label="Done before date" onChange={(e) => setEnd(e.target.value)} />
      </label>
      <button type="button" className="todo-btn" disabled={!name.trim() || !end} onClick={submit}>
        Create range
      </button>
    </div>
  )
}

/** Picker + settings row for the fascia nav line. */
export function TodoRangeNav() {
  const live = useTodoRanges()
  const { activeRangeId } = useTodoPrefs()
  const active = live.find((r) => r.range.id === activeRangeId) ?? live[0]
  const [mode, setMode] = useState<null | "new" | "edit">(null)
  if (!active || mode === "new") {
    return (
      <div className="todo-range-nav">
        <NewRangeForm onDone={() => setMode(null)} />
        {active && (
          <button type="button" className="todo-btn" onClick={() => setMode(null)}>
            Cancel
          </button>
        )}
      </div>
    )
  }
  const { range, name } = active
  const left = daysUntil(range.end)
  return (
    <div className="todo-range-nav" data-ui-name="Range picker" data-ui-help="Load, edit, or open a custom range.">
      <NativeSelect
        aria-label="Load range"
        value={range.id}
        onChange={(e) => setTodoPrefs({ activeRangeId: e.target.value })}
      >
        {live.map(({ range: r, name: n }) => (
          <option key={r.id} value={r.id}>
            {n}
          </option>
        ))}
      </NativeSelect>
      <span className={`todo-range-left${left < 0 ? " is-past" : left <= 3 ? " is-near" : ""}`}>
        {left < 0 ? `${-left}d past` : left === 0 ? "due today" : `${left}d left`} ·{" "}
        {rangeEndDate(range).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
      </span>
      <button type="button" className="todo-btn" onClick={() => openTodoRangeList(range.id)} title={`Open ${name} in Lists`}>
        Open list
      </button>
      <button type="button" className="todo-btn" aria-pressed={mode === "edit"} onClick={() => setMode(mode === "edit" ? null : "edit")}>
        Range settings
      </button>
      <button type="button" className="todo-btn" onClick={() => setMode("new")}>
        New range
      </button>
      {mode === "edit" && (
        <div className="todo-range-edit" role="group" aria-label="Range settings" key={range.id}>
          <label className="todo-inline-field">
            <span className="todo-label">Name</span>
            <input defaultValue={name} onBlur={(e) => updateTodoRange(range.id, { name: e.target.value })} />
          </label>
          <label className="todo-inline-field">
            <span className="todo-label">Starts</span>
            <input
              type="date"
              defaultValue={range.start ?? ""}
              onChange={(e) => updateTodoRange(range.id, { start: e.target.value || null })}
            />
          </label>
          <label className="todo-inline-field" title="Tasks still due on the old date move with it.">
            <span className="todo-label">Done before</span>
            <input
              type="date"
              defaultValue={range.end}
              onChange={(e) => e.target.value && updateTodoRange(range.id, { end: e.target.value })}
            />
          </label>
          <button
            type="button"
            className="todo-btn"
            onClick={() => {
              if (window.confirm(`Delete the range "${name}" and its list? Tasks and their deadlines stay.`)) deleteTodoRange(range.id)
            }}
          >
            Delete range
          </button>
        </div>
      )}
    </div>
  )
}

export function TodoRangeSheet({
  onOpenTask,
  onComplete,
}: {
  onOpenTask: (id: string) => void
  onComplete: (id: string) => void
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const addTask = useTaskStore((s) => s.addTask)
  const live = useTodoRanges()
  const { activeRangeId } = useTodoPrefs()
  const active = live.find((r) => r.range.id === activeRangeId) ?? live[0]
  const [draft, setDraft] = useState("")

  useEffect(() => {
    syncRangeDeadlines(tasks, live.map((r) => r.range))
  }, [tasks, live])

  if (!active) {
    return (
      <div className="todo-sheet todo-range-sheet">
        <p className="todo-empty-inline">
          Name a range with a done-before date, like “before album release”. It gets a list in Lists too.
        </p>
      </div>
    )
  }
  const { range, name } = active
  const inRange = tasksInRange(tasks, range.id)
  const open = inRange
    .filter((t) => !t.completed)
    .sort((a, b) => new Date(a.deadline ?? 0).getTime() - new Date(b.deadline ?? 0).getTime())
  const done = inRange.filter((t) => t.completed)
  const add = () => {
    if (!draft.trim()) return
    const task: Task = createScheduledTodoTask({ description: draft, period: "day", date: new Date() })
    delete task.scheduledDate
    addTask({ ...task, lists: [range.id], deadline: rangeEndDate(range) })
    setDraft("")
  }
  const row = (task: Task) => {
    const due = task.deadline ? formatLocalDateKey(new Date(task.deadline)) : null
    return (
      <li key={task.id} className={`todo-range-row${task.completed ? " is-done" : ""}`}>
        <input
          type="checkbox"
          checked={!!task.completed}
          disabled={!!task.completed}
          aria-label={`Done: ${itemTitleOrUntitled(task)}`}
          onChange={() => onComplete(task.id)}
        />
        <button type="button" className="todo-range-row-name" onClick={() => onOpenTask(task.id)}>
          {itemTitleOrUntitled(task)}
        </button>
        {due && due !== range.end && (
          <span className="todo-range-row-due">
            by {new Date(`${due}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        )}
      </li>
    )
  }
  return (
    <div
      className="todo-sheet todo-range-sheet"
      data-ui-name="Range list"
      data-ui-help="Tasks on this range's list. Each is due before the range ends unless it has an earlier deadline."
      data-ui-docs="components/Home/ToDo/README.md"
    >
      <div className="todo-composer">
        <input
          className="todo-composer-name"
          value={draft}
          placeholder={`Add a task before ${name}…`}
          aria-label="Add a task to this range"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button type="button" className="todo-btn todo-composer-add" onClick={add}>
          Add
        </button>
      </div>
      <section className="todo-band is-assigned" aria-label="Open">
        <h4 className="todo-list-title">
          Open <span className="todo-list-count">{open.length}</span>
        </h4>
        {open.length === 0 ? <p className="todo-empty-inline">Nothing left before {name}.</p> : <ul className="todo-range-list">{open.map(row)}</ul>}
      </section>
      {done.length > 0 && (
        <details className="todo-band">
          <summary className="todo-list-title">
            Done <span className="todo-list-count">{done.length}</span>
          </summary>
          <ul className="todo-range-list">{done.map(row)}</ul>
        </details>
      )}
    </div>
  )
}
