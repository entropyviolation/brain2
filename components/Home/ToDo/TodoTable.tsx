/**
 * components/Home/ToDo/TodoTable.tsx — Period to-do table
 *
 * Renders a single period's (day/week/month) tier-sorted to-do rows with an
 * inline tier select and per-row actions (complete, push, view, hide). Pure
 * presentational component — all mutations are delegated via callbacks.
 */
"use client"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, Eye, EyeOff, ArrowRight, Zap } from "lucide-react"
import type { CompletionStatus, TodoItem } from "@/lib/types"
import { COMPLETION_STATUSES, COMPLETION_STATUS_LABELS, getStatusColor } from "@/lib/completion-status"
import { getScheduleLabel, pushedKeyForPeriod, type TodoPeriod } from "./todo-utils"

const COLLAPSE_THRESHOLD = 8

export function TodoTable({
  todos,
  period,
  isExpanded,
  onToggleExpand,
  onComplete,
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
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-50 grid grid-cols-12 gap-4 p-3 text-sm font-medium border-b">
        <div className="col-span-4">Task</div>
        <div className="col-span-2 text-center">Status</div>
        <div className="col-span-2 text-center">Tier</div>
        <div className="col-span-1 text-center">{pushedLabel}</div>
        <div className="col-span-3 text-center">Actions</div>
      </div>

      <div className="divide-y">
        {visibleTodos.map((todo) => (
          <div
            key={todo.id}
            className="grid grid-cols-12 gap-4 p-3 hover:bg-gray-50 cursor-pointer"
            onClick={() => onTaskClick(todo.taskId || todo.id)}
          >
            <div className="col-span-4">
              <div className="font-medium">{todo.description}</div>
              <div className="text-xs text-gray-500 mt-1">{getScheduleLabel(todo)}</div>
            </div>

            <div className="col-span-2 flex justify-center" onClick={(e) => e.stopPropagation()}>
              <Select
                value={getStatus(todo.id)}
                onValueChange={(value) => onStatusChange(todo.id, value as CompletionStatus)}
              >
                <SelectTrigger className={`w-28 h-8 border ${getStatusColor(getStatus(todo.id))}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPLETION_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {COMPLETION_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 flex justify-center" onClick={(e) => e.stopPropagation()}>
              <Select value={todo.tier} onValueChange={(value) => onTierChange(todo.id, value as TodoItem["tier"])}>
                <SelectTrigger className="w-20 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A+">A+</SelectItem>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="A/B">A/B</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                  <SelectItem value="D">D</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-1 text-center">
              <span className={`font-medium ${todo[pushedKey] > 0 ? "text-orange-600" : "text-gray-600"}`}>
                {todo[pushedKey]}
              </span>
            </div>

            <div className="col-span-3 flex justify-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Mark complete" onClick={() => onComplete(todo.id)}>
                <CheckCircle2 className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-amber-600 hover:text-amber-700"
                title="Just start — focus on the smallest next step"
                onClick={() => onJustStart(todo.taskId || todo.id)}
              >
                <Zap className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title={`Push to ${pushLabel}`} onClick={() => onPush(todo.id, period)}>
                <ArrowRight className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="View details" onClick={() => onTaskClick(todo.taskId || todo.id)}>
                <Eye className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Hide from list" onClick={() => onHide(todo.id)}>
                <EyeOff className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {todos.length === 0 && (
        <div className="p-8 text-center text-gray-500">No tasks scheduled for this {period}</div>
      )}

      {todos.length > COLLAPSE_THRESHOLD && (
        <button
          type="button"
          onClick={onToggleExpand}
          className="w-full border-t p-2 text-sm font-medium text-primary hover:bg-gray-50 transition-colors"
        >
          {isExpanded ? "Show less" : `Show ${hiddenCount} more`}
        </button>
      )}
    </div>
  )
}
