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
import { useTaskStore } from "@/lib/task-store"
import { getOperationTaskTree, selectToDoNext } from "@/lib/operations"
import type { Task } from "@/lib/types"
import { setTaskCompleted } from "./operation-actions"
import { itemTitle } from "@/lib/item-utils"

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
    <div className="ops-panel">
      <div className="ops-deck">
        <div className="ops-deck-head">
          To do next
        </div>
        {next.length === 0 ? (
          <p className="ops-hint">Nothing actionable — add steps or clear dependencies.</p>
        ) : (
          <ul className="space-y-2">
            {next.map((task, i) => (
              <li key={task.id} className="ops-row">
                <span className="tabular-nums text-[10px] text-[#000080]">{String(i + 1).padStart(2, "0")}</span>
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={(e) => setTaskCompleted(task.id, e.target.checked)}
                  aria-label="Mark done"
                />
                <span className="min-w-0 flex-1 truncate text-sm">{itemTitle(task)}</span>
                {onOpenItem && (
                  <button type="button" className="ops-btn ops-icon-btn" title="Open" onClick={() => onOpenItem(task.id)}>
                    ↗
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default ToDoNextRail
