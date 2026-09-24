/**
 * components/Home/ToDo/todo-filters.tsx — Filters and sort, always on the fascia
 *
 * Three milled bays: what to show, how to sort, and the in-progress cap.
 * Native checkbox / select, skinned as keys and recessed fields.
 */
"use client"

import type { TodoPeriod, TodoSortMode, TodoSortOrder, TodoStatusFilter } from "./todo-utils"
import {
  TODO_SORT_OPTIONS,
  TODO_STATUS_FILTERS,
  getTodoSortOptionLabel,
} from "./todo-utils"
import { MIN_WIP_LIMIT, MAX_WIP_LIMIT } from "./todo-prefs"

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
  wipLimit,
  onWipLimitChange,
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
  wipLimit: number
  onWipLimitChange: (value: number) => void
}) {
  return (
    <div className="todo-filters" aria-label="Filters and sort">
      <fieldset className="todo-bay">
        <legend>Show</legend>
        <label className="todo-key-check">
          <input
            type="checkbox"
            checked={availableNow}
            onChange={(e) => onAvailableNowChange(e.target.checked)}
          />
          Available now
        </label>
        <label className="todo-key-check">
          <input
            id="show-all-tasks"
            type="checkbox"
            checked={showAllTasks}
            onChange={(e) => onShowAllTasksChange(e.target.checked)}
          />
          Show all tasks
        </label>
        <label className="todo-filter-field">
          <span className="todo-label" id="status-filter-label">
            Status
          </span>
          <select
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
          </select>
        </label>
      </fieldset>

      <fieldset className="todo-bay">
        <legend>Sort</legend>
        <label className="todo-filter-field">
          <span className="todo-label" id="todo-sort-label">
            Sort
          </span>
          <select
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
          </select>
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
      </fieldset>

      <fieldset className="todo-bay">
        <legend>Pace</legend>
        <label className="todo-filter-field">
          <span className="todo-label" id="todo-wip-limit-label">
            In progress cap
          </span>
          <input
            id="todo-wip-limit"
            aria-labelledby="todo-wip-limit-label"
            type="number"
            min={MIN_WIP_LIMIT}
            max={MAX_WIP_LIMIT}
            value={wipLimit}
            onChange={(e) => onWipLimitChange(Number(e.target.value))}
          />
        </label>
      </fieldset>
    </div>
  )
}
