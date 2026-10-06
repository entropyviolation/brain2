/**
 * components/Home/ToDo/UndoneTodoSection.tsx — Past-period residue
 *
 * Tasks that were scheduled for a day, week, or month that has ended and were
 * not finished. Each period stays on this list on its own, including after a
 * push. Assimilate keeps a still-live past assignment on the coarser To Do
 * list. Push schedules the next open period. Discard cancels it.
 */
"use client"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { Task, TodoItem } from "@/lib/types"
import { isCancelled, isClearedFromWork } from "@/lib/completion-status"
import { getTodoUndoneTitle, undoneLivesOnLabel, type TodoPeriod } from "./todo-utils"
import { itemTitle } from "@/lib/item-utils"

export function UndoneTodoSection({
  todos,
  tasks,
  period,
  pushTitle,
  open,
  onOpenChange,
  onTaskClick,
  onAssimilate,
  onPush,
  onDiscard,
}: {
  todos: TodoItem[]
  tasks: Task[]
  period: TodoPeriod
  pushTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskClick: (taskId: string) => void
  onAssimilate: (taskId: string) => void
  onPush: (taskId: string) => void
  onDiscard: (taskId: string) => void
}) {
  const byId = new Map(tasks.map((t) => [t.id, t]))

  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="todo-section is-undone is-lace"
      data-ui-name="Undone"
      data-ui-help="Scheduled for this period and not finished. Shows once the period has ended."
      data-ui-docs="components/Home/ToDo/README.md"
    >
      <div className="todo-section-head">
        <CollapsibleTrigger asChild>
          <button type="button" className="todo-legend">
            <span aria-hidden>{open ? "▾" : "▸"}</span>
            <span>{getTodoUndoneTitle()}</span>
            <span className="todo-count">({todos.length})</span>
          </button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <p className="todo-hint">Scheduled for this {period} and not finished.</p>
        {todos.length === 0 ? (
          <div className="todo-empty">Nothing scheduled here was left unfinished.</div>
        ) : (
          todos.map((todo) => {
            const taskId = todo.taskId || todo.id
            const task = byId.get(taskId)
            const openWork = !!task && !isClearedFromWork(task) && !isCancelled(task)
            return (
              <div key={todo.id} className="todo-undone-row" onClick={() => onTaskClick(taskId)}>
                <span className="todo-lamp is-undone" aria-hidden />
                <div className="flex-1 min-w-0">
                  <div className="todo-row-name">{itemTitle(todo)}</div>
                  {task && (
                    <div className="todo-row-meta">
                      {task.completed ? "Finished later" : undoneLivesOnLabel(task)}
                    </div>
                  )}
                  {(() => {
                    const pushes =
                      period === "day"
                        ? task?.daysPushed ?? 0
                        : period === "week"
                          ? task?.weeksPushed ?? 0
                          : task?.monthsPushed ?? 0
                    return pushes > 0 ? (
                      <span
                        className="todo-push-plasma"
                        style={{ ["--todo-push" as string]: Math.min(8, pushes) }}
                        title={`${pushes} pushes`}
                      />
                    ) : null
                  })()}
                </div>
                {openWork && (
                  <div className="todo-undone-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="todo-btn"
                      title="Keep it on the bigger list"
                      onClick={() => onAssimilate(taskId)}
                    >
                      Assimilate
                    </button>
                    <button type="button" className="todo-btn" title={pushTitle} onClick={() => onPush(taskId)}>
                      Push
                    </button>
                    <button
                      type="button"
                      className="todo-btn"
                      title="Will not be done"
                      onClick={() => onDiscard(taskId)}
                    >
                      Discard
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
