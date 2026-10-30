/**
 * components/Home/ToDo/ledger/TaskPrereqDialog.tsx — "Needs…" for a whole task
 *
 * What this task waits on: other tasks, written to `Task.dependencies` (the
 * field Available now, Scheduler, Just Start and the critical path read). The
 * search, linked rows and Create row are the Plan event checklist picker
 * (`EventPrereqPicker`), which is presentational. A link that would close a
 * loop is refused with the loop spelled out, the same check item detail uses.
 * Step-level prerequisites are marked in the lid's Steps fold (link mode).
 */
"use client"

import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { EventPrereqPicker } from "@/components/Home/Plan/event-prereq-picker"
import { useTaskStore } from "@/lib/task-store"
import { itemTitle, itemTitleOrUntitled } from "@/lib/item-utils"
import { addTaskPrereq, removeTaskPrereq } from "@/lib/prereqs"
import { isClearedFromWork } from "@/lib/completion-status"
import { createScheduledTodoTask } from "../todo-utils"
import "@/components/Home/Plan/plan-chrome.css"

export function TaskPrereqDialog({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const tasks = useTaskStore((s) => s.tasks)
  const updateTask = useTaskStore((s) => s.updateTask)
  const addTask = useTaskStore((s) => s.addTask)
  const [loop, setLoop] = useState<string | null>(null)

  const task = taskId ? tasks.find((t) => t.id === taskId) : undefined
  const linked = useMemo(
    () => (task?.dependencies ?? []).map((id) => tasks.find((t) => t.id === id)).filter((t): t is NonNullable<typeof t> => !!t),
    [task, tasks],
  )
  const candidates = useMemo(() => {
    if (!task) return []
    const taken = new Set([task.id, ...(task.dependencies ?? [])])
    return tasks.filter((t) => !taken.has(t.id) && !isClearedFromWork(t))
  }, [task, tasks])

  const attach = (needsId: string) => {
    if (!task) return
    const result = addTaskPrereq(task, needsId, tasks)
    if (!result.ok) {
      const names = result.loop.map((id) => itemTitleOrUntitled(tasks.find((t) => t.id === id)))
      setLoop(`That would loop: ${names.join(" → ")}.`)
      return
    }
    setLoop(null)
    updateTask({ ...task, dependencies: result.dependencies })
  }

  const create = (title: string) => {
    if (!task) return
    const draft = createScheduledTodoTask({ description: title, period: "day", date: new Date() })
    delete draft.scheduledDate
    addTask(draft)
    updateTask({ ...task, dependencies: [...(task.dependencies ?? []), draft.id] })
  }

  return (
    <Dialog
      open={!!task}
      onOpenChange={(open) => {
        if (!open) {
          setLoop(null)
          onClose()
        }
      }}
    >
      <DialogContent
        className="todo95-dialog plan95-dialog"
        hideClose
        aria-describedby={undefined}
        data-ui-name="Needs"
        data-ui-help="Tasks that have to be done before this one."
        data-ui-docs="components/Home/ToDo/README.md"
      >
        <div className="todo-dialog-caption">
          <DialogTitle>{task ? `${itemTitle(task)} needs first` : "Needs first"}</DialogTitle>
        </div>
        <div className="todo-dialog-body">
          <EventPrereqPicker
            inputId="todo-prereq-search"
            linked={linked}
            candidates={candidates}
            onAttach={attach}
            onDetach={(id) => task && updateTask({ ...task, dependencies: removeTaskPrereq(task, id) })}
            onCreate={create}
          />
          {loop ? (
            <p className="todo-prereq-loop" role="alert">
              {loop}
            </p>
          ) : null}
          <p className="todo-prereq-note">Steps inside this task: use Needs… on a step in the lid.</p>
          <div className="todo-dialog-actions">
            <button type="button" className="todo-btn" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
