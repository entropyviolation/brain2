/**
 * components/Home/ToDo/DoneTodoSection.tsx — Collapsible completed-tasks list
 *
 * Shows tasks completed in the focused day/week/month with a shortcut to log
 * unplanned wins.
 */
"use client"

import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, Eye } from "lucide-react"
import { format } from "date-fns"
import type { Task, TodoItem } from "@/lib/types"
import { getTaskCompletionDate, type TodoPeriod } from "./todo-utils"
import { AddDoneDialog } from "./AddDoneDialog"

export function DoneTodoSection({
  title,
  todos,
  tasks,
  period,
  open,
  onOpenChange,
  onTaskClick,
  onAddDone,
}: {
  title: string
  todos: TodoItem[]
  tasks: Task[]
  period: TodoPeriod
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskClick: (taskId: string) => void
  onAddDone: (description: string) => void
}) {
  const byId = new Map(tasks.map((t) => [t.id, t]))

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="mt-4">
      <div className="flex items-center justify-between gap-2">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex flex-1 items-center gap-2 rounded-md px-1 py-2 text-left text-sm font-semibold hover:bg-muted/60 transition-colors"
          >
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
            <span>{title}</span>
            <span className="text-muted-foreground font-normal">({todos.length})</span>
          </button>
        </CollapsibleTrigger>
        <AddDoneDialog onAdd={onAddDone} />
      </div>

      <CollapsibleContent>
        <div className="border rounded-lg overflow-hidden mt-2">
          {todos.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nothing logged for this {period} yet.
            </div>
          ) : (
            <div className="divide-y">
              {todos.map((todo) => {
                const task = byId.get(todo.taskId ?? todo.id)
                const completedAt = task ? getTaskCompletionDate(task) : null
                return (
                  <div
                    key={todo.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted/40 cursor-pointer"
                    onClick={() => onTaskClick(todo.taskId || todo.id)}
                  >
                    <div className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{todo.description}</div>
                      {completedAt && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Completed {format(completedAt, "MMM d, h:mm a")}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 shrink-0"
                      title="View details"
                      onClick={(e) => {
                        e.stopPropagation()
                        onTaskClick(todo.taskId || todo.id)
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
