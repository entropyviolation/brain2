/**
 * components/Home/ToDo/TodoTable.tsx — Period to-do table
 *
 * Packed well of tier-sorted rows with native status/tier selects and mill
 * action keys. Pure presentational — mutations stay on the orchestrator.
 */
"use client"

import type { CompletionStatus, TodoItem } from "@/lib/types"
import { COMPLETION_STATUSES, COMPLETION_STATUS_LABELS } from "@/lib/completion-status"
import { getScheduleLabel, pushedKeyForPeriod, type TodoPeriod } from "./todo-utils"
import { itemTitle } from "@/lib/item-utils"

const COLLAPSE_THRESHOLD = 8

export function TodoTable({
  todos,
  period,
  isExpanded,
  onToggleExpand,
  onComplete,
  onMissed,
  onPush,
  onHide,
  onTaskClick,
  onTierChange,
  onJustStart,
  getStatus,
  onStatusChange,
}: {
  todos: TodoItem[]
  period: TodoPeriod
  isExpanded: boolean
  onToggleExpand: () => void
  onComplete: (todoId: string) => void
  onMissed: (todoId: string) => void
  onPush: (todoId: string, period: TodoPeriod) => void
  onHide: (todoId: string) => void
  onTaskClick: (taskId: string) => void
  onTierChange: (todoId: string, tier: TodoItem["tier"]) => void
  onJustStart: (taskId: string) => void
  getStatus: (todoId: string) => CompletionStatus
  onStatusChange: (todoId: string, status: CompletionStatus) => void
}) {
  const pushedKey = pushedKeyForPeriod(period)
  const pushedLabel =
    period === "day" ? "Days (pushed)" : period === "week" ? "Weeks (pushed)" : "Months (pushed)"
  const pushLabel = period === "day" ? "next day" : period === "week" ? "next week" : "next month"

  const visibleTodos = isExpanded ? todos : todos.slice(0, COLLAPSE_THRESHOLD)
  const hiddenCount = todos.length - visibleTodos.length

  return (
    <div className="todo-table">
      <div className="todo-table-head">
        <div>Task</div>
        <div className="todo-center">Status</div>
        <div className="todo-center">Tier</div>
        <div className="todo-center">{pushedLabel}</div>
        <div className="todo-center">Actions</div>
      </div>

      {visibleTodos.map((todo) => {
        const status = getStatus(todo.id)
        const pushed = todo[pushedKey]
        return (
          <div
            key={todo.id}
            className="todo-row"
            onClick={() => onTaskClick(todo.taskId || todo.id)}
          >
            <div>
              <div className="todo-row-name">{itemTitle(todo)}</div>
              <div className="todo-row-meta">{getScheduleLabel(todo)}</div>
            </div>

            <div className="todo-center" onClick={(e) => e.stopPropagation()}>
              <select
                aria-label="Status"
                data-todo-status={status}
                value={status}
                onChange={(e) => onStatusChange(todo.id, e.target.value as CompletionStatus)}
              >
                {COMPLETION_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {COMPLETION_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>

            <div className="todo-center" onClick={(e) => e.stopPropagation()}>
              <select
                aria-label="Tier"
                value={todo.tier}
                onChange={(e) => onTierChange(todo.id, e.target.value as TodoItem["tier"])}
              >
                <option value="A+">A+</option>
                <option value="A">A</option>
                <option value="A/B">A/B</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </div>

            <div className={`todo-center todo-pushed${pushed > 0 ? " is-hot" : ""}`}>{pushed}</div>

            <div className="todo-actions" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="todo-btn" title="Mark complete" onClick={() => onComplete(todo.id)}>
                Done
              </button>
              <button
                type="button"
                className="todo-btn"
                title="Missed opportunity — too late"
                onClick={() => onMissed(todo.id)}
              >
                Missed
              </button>
              <button
                type="button"
                className="todo-btn"
                title="Just start — focus on the smallest next step"
                onClick={() => onJustStart(todo.taskId || todo.id)}
              >
                Start
              </button>
              <button
                type="button"
                className="todo-btn"
                title={`Push to ${pushLabel}`}
                onClick={() => onPush(todo.id, period)}
              >
                Push
              </button>
              <button
                type="button"
                className="todo-btn"
                title="View details"
                onClick={() => onTaskClick(todo.taskId || todo.id)}
              >
                View
              </button>
              <button type="button" className="todo-btn" title="Hide from list" onClick={() => onHide(todo.id)}>
                Hide
              </button>
            </div>
          </div>
        )
      })}

      {todos.length === 0 && (
        <div className="todo-empty">No tasks scheduled for this {period}</div>
      )}

      {todos.length > COLLAPSE_THRESHOLD && (
        <button type="button" onClick={onToggleExpand} className="todo-more">
          {isExpanded ? "Show less" : `Show ${hiddenCount} more`}
        </button>
      )}
    </div>
  )
}
