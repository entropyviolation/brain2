/**
 * components/Home/ToDo/todo-filters.tsx — Filters and sort, always on the fascia
 *
 * One slim strip: show chips, tier, status, sort, formula. Global knobs
 * (sun rites, in-progress cap, default estimate, pace) live behind the gear.
 */
"use client"

import type { TodoPeriod, TodoSortMode, TodoSortOrder, TodoStatusFilter } from "./todo-utils"
import {
  TODO_SORT_OPTIONS,
  TODO_STATUS_FILTERS,
  getTodoSortOptionLabel,
} from "./todo-utils"
import { setTodoPrefs, useTodoPrefs, type TodoTierView } from "./todo-prefs"
import { NativeSelect } from "@/components/ui/native-select"

const TIER_CHOICES: { value: TodoTierView; short: string; title: string }[] = [
  { value: "all", short: "All", title: "Every step" },
  { value: "min", short: "B", title: "Bare minimum: did enough that it counts" },
  { value: "goal", short: "G", title: "Goal: what was intended (includes Bare minimum)" },
  { value: "exceptional", short: "E", title: "Exceptional: above and beyond (includes all)" },
]

/** Tier (Phase 10): every lid shows that level's view. Self-wired to `todo-prefs`. */
function TierKeys() {
  const { tierView } = useTodoPrefs()
  return (
    <div className="todo-segment todo-tier-keys" role="radiogroup" aria-label="Step tier">
      <span className="todo-label">Tier</span>
      {TIER_CHOICES.map(({ value, short, title }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={tierView === value}
          className={`todo-chiclet${tierView === value ? " is-on" : ""}`}
          title={title}
          onClick={() => setTodoPrefs({ tierView: value })}
        >
          {short}
        </button>
      ))}
    </div>
  )
}

/** Hide locked and Show next only (Phase 9), and the Tier filter. Self-wired to `todo-prefs`. */
function StepViewKeys() {
  const { hideLocked, showNextOnly } = useTodoPrefs()
  return (
    <>
      <TierKeys />
      <label
        className="todo-chip"
        title="Hide steps and tasks waiting on an open prerequisite. Unfinished is not locked. They come back when the prerequisite is done."
      >
        <input type="checkbox" checked={hideLocked} onChange={(e) => setTodoPrefs({ hideLocked: e.target.checked })} />
        Hide locked
      </label>
      <label className="todo-chip" title="A branch shows only its next step and how many more. One click opens it.">
        <input type="checkbox" checked={showNextOnly} onChange={(e) => setTodoPrefs({ showNextOnly: e.target.checked })} />
        Show next only
      </label>
    </>
  )
}

export function TodoFilters({
  period,
  availableNow,
  onAvailableNowChange,
  showAllTasks,
  onShowAllTasksChange,
  statusFilter,
  onStatusFilterChange,
  sortMode,
  onSortModeChange,
  sortOrder,
  onSortOrderChange,
  onToggleFormula,
}: {
  period: TodoPeriod
  availableNow: boolean
  onAvailableNowChange: (value: boolean) => void
  showAllTasks: boolean
  onShowAllTasksChange: (value: boolean) => void
  statusFilter: TodoStatusFilter
  onStatusFilterChange: (value: TodoStatusFilter) => void
  sortMode: TodoSortMode
  onSortModeChange: (value: TodoSortMode) => void
  sortOrder: TodoSortOrder
  onSortOrderChange: (value: TodoSortOrder) => void
  onToggleFormula: () => void
}) {
  const chip = (label: string, checked: boolean, onChange: (v: boolean) => void, title?: string, id?: string) => (
    <label className="todo-chip" title={title}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
  return (
    <div
      className="todo-filters"
      aria-label="Filters and sort"
      data-ui-name="Show / Sort / Pace"
      data-ui-help="One strip: show chips, tier, status, sort, and the priority formula."
      data-ui-docs="components/Home/ToDo/README.md"
      data-ui-docs-anchor="options"
    >
      <div className="todo-strip-group" role="group" aria-label="Show">
        {chip("Available now", availableNow, onAvailableNowChange)}
        {chip("All tasks", showAllTasks, onShowAllTasksChange, "Show all tasks", "show-all-tasks")}
        <StepViewKeys />
      </div>

      <span className="todo-strip-rule" aria-hidden />

      <label className="todo-inline-field">
        <span className="todo-label" id="status-filter-label">Status</span>
        <NativeSelect
          id="status-filter"
          aria-labelledby="status-filter-label"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as TodoStatusFilter)}
        >
          {TODO_STATUS_FILTERS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </label>

      <label className="todo-inline-field">
        <span className="todo-label" id="todo-sort-label">Sort</span>
        <NativeSelect
          id="todo-sort"
          aria-labelledby="todo-sort-label"
          value={sortMode}
          onChange={(e) => onSortModeChange(e.target.value as TodoSortMode)}
        >
          {TODO_SORT_OPTIONS.map(({ value }) => (
            <option key={value} value={value}>
              {getTodoSortOptionLabel(value, period)}
            </option>
          ))}
        </NativeSelect>
      </label>
      <button
        type="button"
        className="todo-btn todo-btn-icon"
        title={sortOrder === "asc" ? "Ascending — click for descending" : "Descending — click for ascending"}
        aria-label={sortOrder === "asc" ? "Sort ascending" : "Sort descending"}
        aria-pressed={sortOrder === "desc"}
        onClick={() => onSortOrderChange(sortOrder === "asc" ? "desc" : "asc")}
      >
        {sortOrder === "asc" ? "↑" : "↓"}
      </button>

      <button type="button" className="todo-btn" title="View and reweight the priority formula" onClick={onToggleFormula}>
        Formula
      </button>
    </div>
  )
}
