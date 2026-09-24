/**
 * components/Home/ToDo/MissedTodoSection.tsx — Collapsible missed-opportunities list
 *
 * Sibling of Done: items marked too late for the focused day/week/month.
 */
"use client"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { Task, TodoItem } from "@/lib/types"
import { safeDateFormat } from "@/lib/date-utils"
import { getTaskMissedDate, type TodoPeriod } from "./todo-utils"
import { itemTitle } from "@/lib/item-utils"

export function MissedTodoSection({
  title,
  todos,
  tasks,
  period,
  open,
  onOpenChange,
  onTaskClick,
}: {
  title: string
  todos: TodoItem[]
  tasks: Task[]
  period: TodoPeriod
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskClick: (taskId: string) => void
}) {
  const byId = new Map(tasks.map((t) => [t.id, t]))

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="todo-section">
      <div className="todo-section-head">
        <CollapsibleTrigger asChild>
          <button type="button" className="todo-legend">
            <span aria-hidden>{open ? "▾" : "▸"}</span>
            <span>{title}</span>
            <span className="todo-count">({todos.length})</span>
          </button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        {todos.length === 0 ? (
          <div className="todo-empty">Nothing marked too late for this {period}.</div>
        ) : (
          todos.map((todo) => {
            const task = byId.get(todo.taskId ?? todo.id)
            const missedAt = task ? getTaskMissedDate(task) : null
            return (
              <div
                key={todo.id}
                className="todo-missed-row"
                onClick={() => onTaskClick(todo.taskId || todo.id)}
              >
                <span className="todo-lamp is-missed" aria-hidden />
                <div className="flex-1 min-w-0">
                  <div className="todo-row-name">{itemTitle(todo)}</div>
                  {missedAt && (
                    <div className="todo-row-meta">
                      Too late{period !== "day" ? ` · ${safeDateFormat(missedAt)}` : ""}
                    </div>
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
