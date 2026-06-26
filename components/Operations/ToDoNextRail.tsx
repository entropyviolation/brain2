/**
 * components/Operations/ToDoNextRail.tsx — "To do next" rail
 *
 * A compact side rail surfacing the next actionable tasks across an operation's
 * whole task tree (phases + parts), ranked by `lib/operations.selectToDoNext`
 * (incomplete, dependency-satisfied, deadline/importance ordered). Each row can
 * be marked done or opened.
 */
"use client"

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowUpRight, Target } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { getOperationTaskTree, selectToDoNext } from "@/lib/operations"
import type { Task } from "@/lib/types"
import { setTaskCompleted } from "./operation-actions"

export function ToDoNextRail({
  operation,
  onOpenItem,
  limit = 6,
}: {
  operation: Task
  onOpenItem?: (id: string) => void
  limit?: number
}) {
  const allTasks = useTaskStore((s) => s.tasks)
  const next = useMemo(() => {
    const tree = getOperationTaskTree(operation.id, allTasks)
    return selectToDoNext(tree, { limit })
  }, [operation.id, allTasks, limit])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Target className="h-4 w-4 text-teal-600" />
        To do next
      </div>
      {next.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">
          Nothing actionable — add steps or clear dependencies.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {next.map((task) => (
            <li key={task.id} className="flex items-center gap-2 rounded-md border bg-background/50 px-2.5 py-2">
              <Checkbox
                checked={task.completed}
                onCheckedChange={(c) => setTaskCompleted(task.id, !!c)}
                aria-label="Mark done"
              />
              <span className="min-w-0 flex-1 truncate text-sm">{task.description}</span>
              {onOpenItem && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  title="Open"
                  onClick={() => onOpenItem(task.id)}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default ToDoNextRail
