/**
 * components/Home/ToDo/AddTodoDialog.tsx — "Add Task" dialog for the To-Do panel
 *
 * Collects a description and tier. Scheduled to the active period at the
 * focused date. Self-contained form state; emits a completed draft via `onAdd`.
 */
"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import type { TodoItem } from "@/lib/types"
import { NativeSelect } from "@/components/ui/native-select"

export interface NewTodoDraft {
  description: string
  tier: TodoItem["tier"]
}

const emptyDraft = (): NewTodoDraft => ({
  description: "",
  tier: "A",
})

/** An existing task that Add task can schedule here instead of making a new one. */
export interface ExistingTaskHit {
  id: string
  title: string
  /** Where it lives now, such as "Next Actions" or "on Oct 22". */
  hint?: string
}

export function AddTodoDialog({
  onAdd,
  searchExisting,
  onPickExisting,
  onOpenPickList,
}: {
  onAdd: (draft: NewTodoDraft) => void
  /** From lists: open tasks and Next Actions items matching the words. */
  searchExisting?: (query: string) => ExistingTaskHit[]
  /** Schedules that task on the focused period. */
  onPickExisting?: (taskId: string) => void
  /** The Session planner's flat step list (the old Pick list key). */
  onOpenPickList?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<NewTodoDraft>(emptyDraft)
  const [query, setQuery] = useState("")
  const hits = searchExisting && query.trim() ? searchExisting(query.trim()).slice(0, 8) : []

  const submit = () => {
    if (!draft.description.trim()) return
    onAdd(draft)
    setDraft(emptyDraft())
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="todo-btn todo-cap is-primary todo-add-key"
          title="New task, or find one in your lists that already exists"
        >
          + Add task ▾
        </button>
      </DialogTrigger>
      <DialogContent
        className="todo95-dialog"
        hideClose
        aria-describedby={undefined}
        data-ui-name="Add Task"
        data-ui-help="New task scheduled on the focused period."
        data-ui-docs="components/Home/ToDo/README.md"
      >
        <div className="todo-dialog-caption">
          <DialogTitle>Add New Task</DialogTitle>
        </div>
        <div className="todo-dialog-body">
          <label htmlFor="todo-description">Description</label>
          <input
            id="todo-description"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="Task description"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />

          <label htmlFor="todo-tier">Tier</label>
          <NativeSelect
            id="todo-tier"
            value={draft.tier}
            onChange={(e) => setDraft({ ...draft, tier: e.target.value as TodoItem["tier"] })}
          >
            <option value="A+">A+ (Critical)</option>
            <option value="A">A (High)</option>
            <option value="A/B">A/B (Medium-High)</option>
            <option value="B">B (Medium)</option>
            <option value="C">C (Low)</option>
            <option value="D">D (Very Low)</option>
          </NativeSelect>

          {searchExisting && onPickExisting ? (
            <div className="todo-from-lists" data-ui-name="From lists" data-ui-help="Schedules a task that already exists on this period.">
              <label htmlFor="todo-from-lists">From lists (optional)</label>
              <input
                id="todo-from-lists"
                type="search"
                value={query}
                placeholder="Search tasks and Next Actions"
                onChange={(e) => setQuery(e.target.value)}
              />
              {query.trim() ? (
                hits.length ? (
                  <ul className="todo-from-lists-hits" aria-label="Matching tasks">
                    {hits.map((hit) => (
                      <li key={hit.id}>
                        <button
                          type="button"
                          className="todo-btn todo-from-lists-hit"
                          title="Schedule this task here"
                          onClick={() => {
                            onPickExisting(hit.id)
                            setQuery("")
                            setOpen(false)
                          }}
                        >
                          <span className="todo-from-lists-title">{hit.title}</span>
                          {hit.hint ? <span className="todo-from-lists-hint">{hit.hint}</span> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="todo-hint">Nothing matches.</p>
                )
              ) : null}
            </div>
          ) : null}

          <div className="todo-dialog-actions">
            {onOpenPickList ? (
              <button
                type="button"
                className="todo-btn todo-dialog-aside"
                title="The Session planner's flat list of steps"
                onClick={() => {
                  setOpen(false)
                  onOpenPickList()
                }}
              >
                Pick list…
              </button>
            ) : null}
            <button type="button" className="todo-btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="todo-btn" onClick={submit}>
              Add Task
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
