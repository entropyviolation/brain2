/**
 * components/Home/ToDo/TodoTable.tsx — Period to-do ledger
 *
 * Closed rows show the name (padded), a tier menu, the active lamp, completion
 * percent, and the verb keys Done / Start / Push / Delete. Click / Enter opens
 * one clamshell lid: the header name is the only edit field; Flags, Time, and
 * Steps fold independently. Mutations stay on the orchestrator.
 */
"use client"

import { useEffect, useRef } from "react"
import type { KeyboardEvent } from "react"
import type { CompletionStatus, Subtask, TodoItem } from "@/lib/types"
import { COMPLETION_STATUS_LABELS } from "@/lib/completion-status"
import { PercentLedBar } from "@/components/Home/Habits/percent-led-bar"
import { effectiveDurationMinutes, flattenSteps, formatInternalProgress, todoCompletionPercent } from "@/lib/todo-steps"
import { getScheduleLabel, pushedKeyForPeriod, toggleTodoActiveLamp, type TodoPeriod } from "./todo-utils"
import { itemTitle } from "@/lib/item-utils"
import { TodoBreakdown, TodoDeleteButton, TodoLidSection } from "./TodoBreakdown"

const COLLAPSE_THRESHOLD = 8

const TIERS: TodoItem["tier"][] = ["A+", "A", "A/B", "B", "C", "D"]

const TIER_HINT: Record<TodoItem["tier"], string> = {
  "A+": "Highest urgency and importance",
  A: "High urgency and importance",
  "A/B": "High urgency or importance",
  B: "Solid mid priority",
  C: "Lower urgency and importance",
  D: "Lowest urgency and importance",
}

function statusLampClass(status: CompletionStatus): string {
  if (status === "partial") return "is-power"
  if (status === "deferred") return "is-cold"
  if (status === "cancelled") return "is-off"
  return "is-live"
}

export function TodoTable({
  todos,
  period,
  isExpanded,
  onToggleExpand,
  onComplete,
  onMissed,
  onPush,
  onDelete,
  onEstimateChange,
  onStepsChange,
  stepsOf,
  estimateOf,
  onTaskClick,
  onTierChange,
  onJustStart,
  getStatus,
  onStatusChange,
  isRequired,
  isPrioritized,
  onToggleRequired,
  onTogglePrioritized,
  onRename,
  openRowId,
  onOpenRowIdChange,
  selectedRowId,
  onSelectedRowIdChange,
  dense,
  emptyLabel,
  flockingId,
}: {
  todos: TodoItem[]
  period: TodoPeriod
  isExpanded: boolean
  onToggleExpand: () => void
  onComplete: (todoId: string) => void
  onMissed: (todoId: string) => void
  onPush: (todoId: string, period: TodoPeriod) => void
  onDelete: (todoId: string) => void
  onEstimateChange: (todoId: string, minutes: number | undefined) => void
  onStepsChange: (todoId: string, steps: Subtask[]) => void
  stepsOf: (todoId: string) => Subtask[] | undefined
  estimateOf: (todoId: string) => number | undefined
  onTaskClick: (taskId: string) => void
  onTierChange: (todoId: string, tier: TodoItem["tier"]) => void
  onJustStart: (taskId: string) => void
  getStatus: (todoId: string) => CompletionStatus
  onStatusChange: (todoId: string, status: CompletionStatus) => void
  isRequired: (todoId: string) => boolean
  isPrioritized: (todoId: string) => boolean
  onToggleRequired: (todoId: string) => void
  onTogglePrioritized: (todoId: string) => void
  onRename?: (todoId: string, description: string) => void
  openRowId: string | null
  onOpenRowIdChange: (id: string | null) => void
  selectedRowId: string | null
  onSelectedRowIdChange: (id: string | null) => void
  dense?: boolean
  emptyLabel?: string
  flockingId?: string | null
}) {
  const pushedKey = pushedKeyForPeriod(period)
  const pushLabel = period === "day" ? "next day" : period === "week" ? "next week" : "next month"
  const listRef = useRef<HTMLDivElement>(null)

  const visibleTodos = isExpanded ? todos : todos.slice(0, COLLAPSE_THRESHOLD)
  const hiddenCount = todos.length - visibleTodos.length
  // Join, not the sliced array: slice() is a new array every render and would refocus every time.
  const visibleIdKey = visibleTodos.map((todo) => todo.id).join("\0")

  useEffect(() => {
    if (!selectedRowId) return
    const visibleIds = visibleIdKey.length === 0 ? [] : visibleIdKey.split("\0")
    if (!visibleIds.includes(selectedRowId)) return
    const root = listRef.current
    if (!root) return
    const row = root.querySelector(`[data-todo-row="${selectedRowId}"]`) as HTMLElement | null
    row?.focus({ preventScroll: false })
  }, [selectedRowId, visibleIdKey])

  const handleRowKey = (event: KeyboardEvent, todo: TodoItem) => {
    const target = event.target as HTMLElement
    if (target.closest("input, textarea, select, [contenteditable='true']")) return

    const ids = visibleTodos.map((t) => t.id)
    const at = ids.indexOf(todo.id)

    if (event.key === "ArrowDown") {
      event.preventDefault()
      const next = ids[Math.min(ids.length - 1, at + 1)]
      if (next) onSelectedRowIdChange(next)
      return
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      const prev = ids[Math.max(0, at - 1)]
      if (prev) onSelectedRowIdChange(prev)
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      onOpenRowIdChange(openRowId === todo.id ? null : todo.id)
      onSelectedRowIdChange(todo.id)
      return
    }
    if (event.key === "Escape") {
      event.preventDefault()
      onOpenRowIdChange(null)
      return
    }
    if (event.key === "d" || event.key === "D") {
      event.preventDefault()
      onComplete(todo.id)
      return
    }
    if (event.key === "m" || event.key === "M") {
      event.preventDefault()
      onMissed(todo.id)
      return
    }
    if (event.key === "p" || event.key === "P") {
      event.preventDefault()
      onPush(todo.id, period)
      return
    }
    if (event.key === "r" || event.key === "R") {
      event.preventDefault()
      onToggleRequired(todo.id)
      return
    }
  }

  return (
    <div
      ref={listRef}
      className={`todo-table${dense ? " is-dense" : ""}`}
      role="list"
    >
      {visibleTodos.map((todo) => {
        const status = getStatus(todo.id)
        const pushed = todo[pushedKey]
        const required = isRequired(todo.id)
        const prioritized = isPrioritized(todo.id)
        const name = itemTitle(todo)
        const steps = stepsOf(todo.id)
        const flat = flattenSteps(steps)
        const stepCount = flat.length
        const doneSteps = flat.filter((s) => s.completed).length
        const estimate = estimateOf(todo.id)
        const minutes = effectiveDurationMinutes(estimate, steps)
        const progress = formatInternalProgress(steps)
        const completePct = todoCompletionPercent(steps)
        const open = openRowId === todo.id
        const selected = selectedRowId === todo.id
        const flocking = flockingId === todo.id
        const toggleOpen = () => {
          onSelectedRowIdChange(todo.id)
          onOpenRowIdChange(open ? null : todo.id)
        }

        return (
          <div
            key={todo.id}
            className={`todo-row${open ? " is-open" : ""}${selected ? " is-selected" : ""}${flocking ? " is-flocking" : ""}`}
            data-todo-row={todo.id}
            role="listitem"
            tabIndex={0}
            aria-expanded={open}
            onClick={() => {
              onSelectedRowIdChange(todo.id)
            }}
            onKeyDown={(e) => handleRowKey(e, todo)}
          >
            <div className="todo-row-closed">
              <div className="todo-row-nameplate">
                {open ? (
                  <button
                    type="button"
                    className="todo-row-fold"
                    data-no95
                    aria-expanded
                    aria-label="Collapse task"
                    title="Collapse"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleOpen()
                    }}
                  />
                ) : null}
                {open && onRename ? (
                  <input
                    className="todo-row-name"
                    type="text"
                    defaultValue={name}
                    aria-label="Task name"
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      const next = e.target.value.trim()
                      if (next && next !== name) onRename(todo.id, next)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="todo-row-name"
                    data-no95
                    title={name}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleOpen()
                    }}
                  >
                    {name}
                  </button>
                )}
                {pushed > 0 ? (
                  <span className="todo-push-tube is-hot" title={`${pushed} pushes`}>
                    {pushed}
                  </span>
                ) : null}
              </div>

              <select
                className="todo-nixie"
                aria-label="Tier"
                title={`Tier ${todo.tier} — ${TIER_HINT[todo.tier]}`}
                value={todo.tier}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation()
                  onTierChange(todo.id, e.target.value as TodoItem["tier"])
                }}
              >
                {TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className={`todo-status-lamp ${statusLampClass(status)}`}
                data-no95
                aria-label="Active"
                aria-pressed={status === "active"}
                data-todo-status={status}
                title={
                  status === "active"
                    ? "Active. Click to mark in progress. The task stays on this list."
                    : status === "partial"
                      ? "In progress. Click to mark active. The task stays on this list."
                      : `${COMPLETION_STATUS_LABELS[status]}. Click to mark active.`
                }
                onClick={(e) => {
                  e.stopPropagation()
                  onStatusChange(todo.id, toggleTodoActiveLamp(status))
                }}
              >
                <span className="todo-status-pip" aria-hidden />
              </button>

              <span
                className="todo-row-mins"
                title={
                  minutes > 0
                    ? `${completePct}% complete · ${minutes} minutes that count`
                    : `${completePct}% complete`
                }
              >
                <PercentLedBar value={completePct} label="Complete" density="compact" />
                {minutes > 0 ? <span className="todo-mins-read">{minutes}m</span> : null}
              </span>

              {stepCount > 0 ? (
                <span className="todo-step-chip" title={progress ?? `${stepCount} steps`}>
                  {doneSteps}/{stepCount}
                  {minutes > 0 ? ` · ${minutes}m` : ""}
                </span>
              ) : null}

              <div
                className="todo-row-verbs"
                role="toolbar"
                aria-label="Task actions"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="todo-verb is-complete"
                  title="Mark complete"
                  onClick={() => onComplete(todo.id)}
                >
                  Done
                </button>
                <button
                  type="button"
                  className="todo-verb"
                  title="Just start — focus on the smallest next step"
                  onClick={() => onJustStart(todo.taskId || todo.id)}
                >
                  Start
                </button>
                <button
                  type="button"
                  className="todo-verb is-push"
                  title={`Push to ${pushLabel}`}
                  onClick={() => onPush(todo.id, period)}
                >
                  Push
                </button>
                <TodoDeleteButton
                  prompt={
                    stepCount > 0
                      ? `Delete "${name}" and its ${stepCount} steps?`
                      : `Delete "${name}"?`
                  }
                  onDelete={() => onDelete(todo.id)}
                />
              </div>
            </div>

            {open ? (
              <div className="todo-lid" onClick={(e) => e.stopPropagation()}>
                <div className="todo-lid-meta">
                  {getScheduleLabel(todo)}
                  {todo.daysOverdue > 0 ? ` · waiting ${todo.daysOverdue}d` : ""}
                </div>
                <TodoLidSection id="flags" label="Flags" layout="flags">
                  <button
                    type="button"
                    className="todo-jewel is-required"
                    aria-pressed={required}
                    aria-label="Required"
                    title="Required — absolutely must be done this period"
                    onClick={() => onToggleRequired(todo.id)}
                  >
                    <span className="todo-jewel-glass" aria-hidden />
                    <span className="todo-jewel-word">Required</span>
                  </button>
                  <button
                    type="button"
                    className="todo-jewel is-prioritized"
                    aria-pressed={prioritized}
                    aria-label="Prioritized"
                    title="Prioritized — stays on Assigned, marked"
                    onClick={() => onTogglePrioritized(todo.id)}
                  >
                    <span className="todo-jewel-glass" aria-hidden />
                    <span className="todo-jewel-word">Prioritized</span>
                  </button>
                  <button
                    type="button"
                    className="todo-verb is-missed"
                    title="Missed opportunity — too late"
                    onClick={() => onMissed(todo.id)}
                  >
                    Missed
                  </button>
                  <button
                    type="button"
                    className="todo-verb"
                    title="View details"
                    onClick={() => onTaskClick(todo.taskId || todo.id)}
                  >
                    View
                  </button>
                </TodoLidSection>
                <TodoBreakdown
                  estimate={estimate}
                  steps={steps}
                  onEstimateChange={(minutes) => onEstimateChange(todo.id, minutes)}
                  onStepsChange={(next) => onStepsChange(todo.id, next)}
                />
              </div>
            ) : null}
          </div>
        )
      })}

      {todos.length === 0 && (
        <div className="todo-empty">{emptyLabel ?? `No tasks scheduled for this ${period}`}</div>
      )}

      {todos.length > COLLAPSE_THRESHOLD && (
        <button type="button" onClick={onToggleExpand} className="todo-more">
          {isExpanded ? "Show less" : `Show ${hiddenCount} more`}
        </button>
      )}
    </div>
  )
}
