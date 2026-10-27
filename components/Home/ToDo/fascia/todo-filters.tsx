/**
 * components/Home/ToDo/todo-filters.tsx — The Show tray and the sort key
 *
 * `TodoFilters` is the Show tray under the key field, in two rows: the show
 * chips, then tier, status, formula, and Open list. `TodoSortKeys` (sort and its direction)
 * stays on the key field beside Show. Global knobs (sun rites, in-progress
 * cap, default estimate, pace) live behind the globe settings key.
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

/** Hide locked and Show next only (Phase 9). Self-wired to `todo-prefs`. */
function StepViewKeys() {
  const { hideLocked, showNextOnly } = useTodoPrefs()
  return (
    <>
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
  onToggleFormula,
  listName,
  onOpenList,
}: {
  period: TodoPeriod
  availableNow: boolean
  onAvailableNowChange: (value: boolean) => void
  showAllTasks: boolean
  onShowAllTasksChange: (value: boolean) => void
  statusFilter: TodoStatusFilter
  onStatusFilterChange: (value: TodoStatusFilter) => void
  onToggleFormula: () => void
  /** Period To do list in Lists, such as `To do 8/31-9/6`. */
  listName?: string
  onOpenList?: () => void
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
      data-ui-help="The Show tray: show chips, tier, status, the priority formula, and Open list."
      data-ui-docs="components/Home/ToDo/README.md"
      data-ui-docs-anchor="options"
    >
      {/* Row 1: what shows. Row 2: how it narrows, then the formula and the list. */}
      <div className="todo-strip-group todo-filters-row" role="group" aria-label="Show">
        <span className="todo-label">Show</span>
        {chip("Available now", availableNow, onAvailableNowChange)}
        {chip("All tasks", showAllTasks, onShowAllTasksChange, "Show all tasks", "show-all-tasks")}
        <StepViewKeys />
      </div>

      <div className="todo-filters-row is-tune">
        <TierKeys />

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

        <span className="todo-strip-rule" aria-hidden />

        <button type="button" className="todo-btn" title="View and reweight the priority formula" onClick={onToggleFormula}>
          Formula
        </button>

        {listName && onOpenList ? (
          <button
            type="button"
            className="todo-btn todo-open-list"
            title={`Open ${listName} in Lists`}
            aria-label={`Open ${listName} in Lists`}
            onClick={onOpenList}
          >
            Open list
          </button>
        ) : null}
      </div>
    </div>
  )
}

/** Sort and its direction, on the key field beside Show. */
export function TodoSortKeys({
  period,
  sortMode,
  onSortModeChange,
  sortOrder,
  onSortOrderChange,
}: {
  period: TodoPeriod
  sortMode: TodoSortMode
  onSortModeChange: (value: TodoSortMode) => void
  sortOrder: TodoSortOrder
  onSortOrderChange: (value: TodoSortOrder) => void
}) {
  return (
    <div className="todo-sort-keys" role="group" aria-label="Sort order">
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
        <svg className="todo-sort-arrow" viewBox="0 0 12 14" aria-hidden>
          <path
            d={sortOrder === "asc" ? "M6 12.5V2M2 5.5 6 1.5l4 4" : "M6 1.5V12M2 8.5l4 4 4-4"}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

    </div>
  )
}
