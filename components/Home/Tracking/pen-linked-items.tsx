/**
 * components/Home/Tracking/pen-linked-items.tsx — Linked items, in Pen settings
 *
 * The pen side of `Task.penLinks` (Phase 5, `docs/TODO_REDESIGN.md`). Item
 * detail edits the same field from the task side. Lists the tasks linked to
 * this pen; × unlinks, the search links an open task. Writes go straight to
 * the task store (they are the task's field, not the pen's), so Save pen does
 * not hold them.
 */
"use client"

import { useMemo, useState } from "react"
import { Plus, X } from "lucide-react"
import { Label } from "@/components/ui/label"
import { useTaskStore } from "@/lib/task-store"
import { setTaskPenLinked, tasksLinkedToPen } from "@/lib/task-clock"
import { isOpen } from "@/lib/completion-status"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import "@/components/ItemDetail/item-pen-time.css"

export function PenLinkedItems({ scopeId, penId, penName }: { scopeId: string; penId: string; penName: string }) {
  const tasks = useTaskStore((s) => s.tasks)
  const [query, setQuery] = useState("")
  const linked = useMemo(() => tasksLinkedToPen(tasks, penId), [tasks, penId])
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return []
    return tasks
      .filter((t) => isOpen(t) && !t.penLinks?.some((l) => l.penId === penId))
      .filter((t) => itemTitleOrUntitled(t, "").toLowerCase().includes(needle))
      .slice(0, 8)
  }, [tasks, query, penId])

  return (
    <div className="trk-section space-y-2" data-ui-name="Pen linked items">
      <Label className="trk-section-title">Linked items</Label>
      <p className="trk-help">
        Time painted with <strong>{penName}</strong> counts on these tasks (item detail → Time). ▶ on a task paints with
        its first linked pen.
      </p>
      <div className="ipt-chips">
        {linked.length === 0 && <span className="ipt-quiet">No items linked.</span>}
        {linked.map((task) => (
          <span key={task.id} className="ipt-chip">
            {itemTitleOrUntitled(task)}
            <button
              type="button"
              className="ipt-x"
              aria-label={`Unlink ${itemTitleOrUntitled(task)}`}
              onClick={() => setTaskPenLinked(task.id, scopeId, penId, false)}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="ipt-picker">
        <input
          className="ipt-search"
          placeholder="Link a task…"
          aria-label="Link a task"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches[0]) {
              e.preventDefault()
              setTaskPenLinked(matches[0].id, scopeId, penId, true)
              setQuery("")
            }
          }}
        />
        {matches.length > 0 && (
          <ul className="ipt-options" role="listbox" aria-label="Tasks">
            {matches.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    setTaskPenLinked(task.id, scopeId, penId, true)
                    setQuery("")
                  }}
                >
                  <Plus className="h-3 w-3" />
                  {itemTitleOrUntitled(task)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
