/**
 * components/Home/ToDo/desk/todo-assigned-search.tsx — Assigned search label
 *
 * The same label on the period sheet and the season sheet. Search copy stays
 * "Search" / "Search assigned tasks".
 */
import type { ChangeEvent } from "react"

export function TodoAssignedSearch({
  value,
  onChange,
}: {
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <label className="todo-search">
      <span className="todo-visually-hidden">Search</span>
      <input
        type="search"
        value={value}
        placeholder="Search assigned tasks"
        aria-label="Search assigned tasks"
        onChange={onChange}
      />
    </label>
  )
}
