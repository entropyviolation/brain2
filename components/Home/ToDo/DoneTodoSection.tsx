/**
 * components/Home/ToDo/DoneTodoSection.tsx — Collapsible completed-tasks list
 *
 * Shows tasks completed in the focused day/week/month with a shortcut to log
 * unplanned wins. Each row carries when the work happened (`CompletionTimeLine`).
 */
"use client"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { Task, TodoItem } from "@/lib/types"
import { hasUnconfirmedEstimates } from "@/lib/estimated-values"
import type { ConfirmedTimes } from "@/lib/services/completion-time-service"
import { getTaskCompletionDate, type TodoPeriod } from "./todo-utils"
import { AddDoneDialog } from "./AddDoneDialog"
import { CompletionTimeLine } from "./CompletionTimeLine"
import { itemTitle } from "@/lib/item-utils"

export function DoneTodoSection({
  title,
  todos,
  tasks,
  period,
  open,
  onOpenChange,
  onTaskClick,
  onAddDone,
  onConfirmTimes,
}: {
  title: string
  todos: TodoItem[]
  tasks: Task[]
  period: TodoPeriod
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskClick: (taskId: string) => void
  onAddDone: (description: string) => void
  onConfirmTimes?: (taskId: string, values: ConfirmedTimes) => void
}) {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const assumedCount = todos.filter((todo) => {
    const task = byId.get(todo.taskId ?? todo.id)
    return task ? hasUnconfirmedEstimates(task) : false
  }).length

  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="todo-section is-done"
      data-ui-name="Done"
      data-ui-help="Finished work for this period, including assumed times."
      data-ui-docs="components/Home/ToDo/README.md"
      data-ui-docs-anchor="done-rows-carry-a-real-time-and-say-when-it-was-assumed"
    >
      <div className="todo-section-head">
        <CollapsibleTrigger asChild>
          <button type="button" className="todo-legend">
            <span aria-hidden>{open ? "▾" : "▸"}</span>
            <span>{title}</span>
            <span className="todo-count">({todos.length})</span>
            {assumedCount > 0 && (
              <span
                className="todo-est"
                title={`${assumedCount} row${assumedCount === 1 ? "" : "s"} carry an assumed time waiting to be confirmed`}
              >
                {assumedCount} est.
              </span>
            )}
          </button>
        </CollapsibleTrigger>
        <AddDoneDialog onAdd={onAddDone} />
      </div>

      <CollapsibleContent>
        {todos.length === 0 ? (
          <div className="todo-empty">Nothing logged for this {period} yet.</div>
        ) : (
          todos.map((todo) => {
            const task = byId.get(todo.taskId ?? todo.id)
            const completedAt = task ? getTaskCompletionDate(task) : null
            return (
              <div
                key={todo.id}
                className="todo-done-row"
                onClick={() => onTaskClick(todo.taskId || todo.id)}
              >
                <span className="todo-lamp is-done" aria-hidden />
                <div className="flex-1 min-w-0">
                  <div className="todo-row-name">{itemTitle(todo)}</div>
                  {task && completedAt && (
                    <CompletionTimeLine
                      task={task}
                      completedAt={completedAt}
                      showDate={period !== "day"}
                      onConfirm={onConfirmTimes}
                    />
                  )}
                </div>
                <button
                  type="button"
                  className="todo-btn"
                  title="View details"
                  onClick={(e) => {
                    e.stopPropagation()
                    onTaskClick(todo.taskId || todo.id)
                  }}
                >
                  View
                </button>
              </div>
            )
          })
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
