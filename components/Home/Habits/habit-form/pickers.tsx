/**
 * components/Home/Habits/habit-form/pickers.tsx — Searchable menus on the habit form.
 *
 * `DailyHabitPicker` and `ListSentPicker` moved here unchanged. They stay
 * two components. The labels, empty rows, and “no match” sentences differ.
 */
"use client"

import { useEffect, useId, useRef, useState } from "react"

/** Searchable daily-habit menu. Same Win95 trigger as completion sources; type-to-filter like the pen parent picker. */
export function DailyHabitPicker({
  habits,
  habitId,
  onChange,
}: {
  habits: { id: string; name: string }[]
  habitId: string
  onChange: (habitId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const buttonId = useId()
  const selected = habits.find((habit) => habit.id === habitId)
  const needle = query.trim().toLowerCase()
  const matches = needle ? habits.filter((habit) => habit.name.toLowerCase().includes(needle)) : habits

  const close = () => {
    setOpen(false)
    setQuery("")
  }

  useEffect(() => {
    if (!open) return
    const shut = () => {
      setOpen(false)
      setQuery("")
    }
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) shut()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.stopPropagation()
      shut()
    }
    window.addEventListener("mousedown", onPointer)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", onPointer)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div className="habit95-field">
      <label htmlFor={buttonId}>Add up this daily habit</label>
      <div className="habit95-pick" ref={rootRef}>
        <button
          id={buttonId}
          type="button"
          className="habit95-select"
          aria-label="Daily habit to add up"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={menuId}
          onClick={() => (open ? close() : setOpen(true))}
        >
          <span className="habit95-select-label">{selected?.name || "Choose a daily habit"}</span>
          <span className="habit95-select-arrow" aria-hidden />
        </button>
        {open ? (
          <div className="habit95-select-menu habit95-habit-menu" id={menuId} role="listbox" aria-label="Daily habits">
            <input
              className="habit95-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search daily habits"
              aria-label="Search daily habits"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault()
              }}
            />
            <div className="habit95-habit-options">
              {needle ? null : (
                <button
                  type="button"
                  role="option"
                  aria-selected={!habitId}
                  data-active={!habitId ? "true" : undefined}
                  className="habit95-habit-option"
                  onClick={() => {
                    onChange("")
                    close()
                  }}
                >
                  Choose a daily habit
                </button>
              )}
              {matches.map((habit) => (
                <button
                  key={habit.id}
                  type="button"
                  role="option"
                  aria-selected={habit.id === habitId}
                  data-active={habit.id === habitId ? "true" : undefined}
                  className="habit95-habit-option"
                  onClick={() => {
                    onChange(habit.id)
                    close()
                  }}
                >
                  {habit.name}
                </button>
              ))}
              {matches.length === 0 ? <p className="habit95-hint">No daily habits match “{query.trim()}”.</p> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Searchable list menu. Same Win95 trigger as the daily-habit picker. */
export function ListSentPicker({
  lists,
  listId,
  onChange,
}: {
  lists: { id: string; name: string }[]
  listId: string
  onChange: (listId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const buttonId = useId()
  const selected = lists.find((list) => list.id === listId)
  const needle = query.trim().toLowerCase()
  const matches = needle ? lists.filter((list) => list.name.toLowerCase().includes(needle)) : lists

  const close = () => {
    setOpen(false)
    setQuery("")
  }

  useEffect(() => {
    if (!open) return
    const shut = () => {
      setOpen(false)
      setQuery("")
    }
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) shut()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.stopPropagation()
      shut()
    }
    window.addEventListener("mousedown", onPointer)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", onPointer)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div className="habit95-field">
      <label htmlFor={buttonId}>List</label>
      <div className="habit95-pick" ref={rootRef}>
        <button
          id={buttonId}
          type="button"
          className="habit95-select"
          aria-label="List to read sent items from"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={menuId}
          onClick={() => (open ? close() : setOpen(true))}
        >
          <span className="habit95-select-label">{selected?.name || "Choose a list"}</span>
          <span className="habit95-select-arrow" aria-hidden />
        </button>
        {open ? (
          <div className="habit95-select-menu habit95-habit-menu" id={menuId} role="listbox" aria-label="Lists">
            <input
              className="habit95-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search lists"
              aria-label="Search lists"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault()
              }}
            />
            <div className="habit95-habit-options">
              {needle ? null : (
                <button
                  type="button"
                  role="option"
                  aria-selected={!listId}
                  data-active={!listId ? "true" : undefined}
                  className="habit95-habit-option"
                  onClick={() => {
                    onChange("")
                    close()
                  }}
                >
                  Choose a list
                </button>
              )}
              {matches.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  role="option"
                  aria-selected={list.id === listId}
                  data-active={list.id === listId ? "true" : undefined}
                  className="habit95-habit-option"
                  onClick={() => {
                    onChange(list.id)
                    close()
                  }}
                >
                  {list.name}
                </button>
              ))}
              {matches.length === 0 ? <p className="habit95-hint">No lists match “{query.trim()}”.</p> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
